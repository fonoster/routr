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
import io.routr.message.From;
import io.routr.message.SIPMessage;
import io.routr.message.SipURI;
import io.routr.message.To;
import io.routr.processor.MessageResponse;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
}
