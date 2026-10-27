/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr.
 *
 * Licensed under the MIT License (the "License");
 * you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *    https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.routr.utils;

import io.routr.message.Address;
import io.routr.message.CallID;
import io.routr.message.Extension;
import io.routr.message.From;
import io.routr.message.SIPMessage;
import io.routr.message.SipURI;
import io.routr.message.ResponseType;
import io.routr.message.To;
import io.routr.processor.MessageResponse;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class EventProcessorTest {
  private static From from(String user, String host) {
    return From.newBuilder()
        .setAddress(Address.newBuilder().setUri(SipURI.newBuilder().setUser(user).setHost(host)))
        .build();
  }

  // What the processor answers for an INVITE leaving through a Trunk with
  // rewriteFromWithNumber: From is the Number at the carrier's domain
  private static MessageResponse rewritten() {
    var message = SIPMessage.newBuilder()
        .setCallId(CallID.newBuilder().setCallId("call-1"))
        .setFrom(from("+18295863314", "sip.provider.net"))
        .setTo(To.newBuilder()
            .setAddress(Address.newBuilder().setUri(SipURI.newBuilder().setUser("+17853178071").setHost("sip.local"))))
        .build();
    return MessageResponse.newBuilder().setMessage(message).build();
  }

  private static List<Map<String, Object>> capture(EventProcessor[] holder) {
    List<Map<String, Object>> events = new ArrayList<>();
    holder[0] = new EventProcessor(List.of((name, event) -> events.add(event)));
    return events;
  }

  @Test
  public void callStartedNamesTheCallerAsItArrived() {
    var holder = new EventProcessor[1];
    var events = capture(holder);

    holder[0].processCallStartedEvent(rewritten(), from("1001", "sip.local"));

    assertEquals("sip:1001@sip.local", events.get(0).get("from"));
    assertEquals("sip:+17853178071@sip.local", events.get(0).get("to"));
  }

  @Test
  public void callStartedFallsBackToTheProcessorsFrom() {
    var holder = new EventProcessor[1];
    var events = capture(holder);

    holder[0].processCallStartedEvent(rewritten(), null);

    assertEquals("sip:+18295863314@sip.provider.net", events.get(0).get("from"));
  }

  private static MessageResponse invite(String callId, Extension... extensions) {
    var message = SIPMessage.newBuilder()
        .setCallId(CallID.newBuilder().setCallId(callId))
        .setFrom(from("1001", "sip.local"))
        .setTo(To.newBuilder()
            .setAddress(Address.newBuilder().setUri(SipURI.newBuilder().setUser("1002").setHost("sip.local"))))
        .addAllExtensions(List.of(extensions))
        .build();
    return MessageResponse.newBuilder().setMessage(message).build();
  }

  // The answer to the BYE: endpoints do not echo the INVITE's X- headers
  private static MessageResponse byeAnswered(String callId, Extension... extensions) {
    var message = SIPMessage.newBuilder()
        .setCallId(CallID.newBuilder().setCallId(callId))
        .setResponseType(ResponseType.OK)
        .addAllExtensions(List.of(extensions))
        .build();
    return MessageResponse.newBuilder().setMessage(message).build();
  }

  // What GRPCSipListener.processIOException builds: only the call ID is set
  private static MessageResponse transportErrorCleanup(String callId) {
    var message = SIPMessage.newBuilder().setCallId(CallID.newBuilder().setCallId(callId)).build();
    return MessageResponse.newBuilder().setMessage(message).build();
  }

  private static Extension header(String name, String value) {
    return Extension.newBuilder().setName(name).setValue(value).build();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, String> extraHeaders(Map<String, Object> event) {
    return (Map<String, String>) event.get("extraHeaders");
  }

  @Test
  public void callEndedCarriesTheExtraHeadersOfCallStarted() {
    var holder = new EventProcessor[1];
    var events = capture(holder);

    holder[0].processCallStartedEvent(invite("call-1", header("X-Call-Ref", "ref-1"),
        header("X-Tenant", "acme"), header("User-Agent", "softphone")));
    holder[0].processCallEndedEvent(byeAnswered("call-1"));

    assertEquals(Map.of("X-Call-Ref", "ref-1", "X-Tenant", "acme"), extraHeaders(events.get(1)));
  }

  @Test
  public void callEndedReleasesTheRecordedHeaders() {
    var holder = new EventProcessor[1];
    var events = capture(holder);

    holder[0].processCallStartedEvent(invite("call-1", header("X-Call-Ref", "ref-1")));
    assertTrue(holder[0].hasStartedCall("call-1"));

    holder[0].processCallEndedEvent(byeAnswered("call-1"));
    holder[0].processCallEndedEvent(byeAnswered("call-1"));

    assertFalse(holder[0].hasStartedCall("call-1"));
    assertEquals(Map.of(), extraHeaders(events.get(2)));
  }

  @Test
  public void callEndedOnTransportErrorCarriesTheExtraHeadersOfCallStarted() {
    var holder = new EventProcessor[1];
    var events = capture(holder);

    holder[0].processCallStartedEvent(invite("call-1", header("X-Call-Ref", "ref-1")));
    holder[0].processCallEndedEvent(transportErrorCleanup("call-1"));

    assertEquals(Map.of("X-Call-Ref", "ref-1"), extraHeaders(events.get(1)));
    assertEquals("call-1", events.get(1).get("callId"));
  }

  @Test
  public void callEndedHeadersOverrideThoseOfCallStarted() {
    var holder = new EventProcessor[1];
    var events = capture(holder);

    holder[0].processCallStartedEvent(invite("call-1", header("X-Call-Ref", "ref-1"),
        header("X-State", "ringing")));
    holder[0].processCallEndedEvent(byeAnswered("call-1", header("X-State", "done")));

    assertEquals(Map.of("X-Call-Ref", "ref-1", "X-State", "done"), extraHeaders(events.get(1)));
  }

  @Test
  public void repeatedInviteKeepsTheFirstInvitesHeaders() {
    var holder = new EventProcessor[1];
    var events = capture(holder);

    // An authentication retry or re-INVITE on the same call without the header
    holder[0].processCallStartedEvent(invite("call-1", header("X-Call-Ref", "ref-1")));
    holder[0].processCallStartedEvent(invite("call-1", header("X-Other", "x")));
    holder[0].processCallEndedEvent(byeAnswered("call-1"));

    assertEquals(Map.of("X-Call-Ref", "ref-1", "X-Other", "x"), extraHeaders(events.get(2)));
  }

  @Test
  public void recordedHeadersExpireAndAreBounded() {
    var now = new AtomicLong();
    List<Map<String, Object>> events = new ArrayList<>();
    var processor = new EventProcessor(List.of((name, event) -> events.add(event)), 2, 1000, now::get);

    processor.processCallStartedEvent(invite("stale", header("X-Call-Ref", "ref-0")));
    now.set(1000);
    // Recording the next call sweeps the one past its TTL
    processor.processCallStartedEvent(invite("call-1", header("X-Call-Ref", "ref-1")));
    assertFalse(processor.hasStartedCall("stale"));

    processor.processCallStartedEvent(invite("call-2", header("X-Call-Ref", "ref-2")));
    processor.processCallStartedEvent(invite("call-3", header("X-Call-Ref", "ref-3")));

    // Past the cap the oldest call is dropped
    assertFalse(processor.hasStartedCall("call-1"));
    assertTrue(processor.hasStartedCall("call-2"));
    assertTrue(processor.hasStartedCall("call-3"));

    // An entry past its TTL is not attached even if no sweep has removed it yet
    now.set(2000);
    processor.processCallEndedEvent(byeAnswered("call-2"));
    assertEquals(Map.of(), extraHeaders(events.get(events.size() - 1)));
  }
}
