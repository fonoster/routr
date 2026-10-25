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

import io.routr.HangupCauses;
import io.routr.events.EventsPublisher;
import io.routr.events.EventTypes;
import io.routr.headers.ResponseCode;
import io.routr.message.Extension;
import io.routr.message.ResponseType;
import io.routr.message.SIPMessage;
import io.routr.processor.MessageRequest;
import io.routr.processor.MessageResponse;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Processes and publishes SIP events.
 */
public class EventProcessor {
  private final List<EventsPublisher> publishers;

  public EventProcessor(List<EventsPublisher> publishers) {
    this.publishers = publishers;
  }

  /**
   * Processes a call started event.
   * 
   * @param response The message response containing call information
   */
  public void processCallStartedEvent(MessageResponse response) {
    processCallStartedEvent(response, response.getMessage().getFrom());
  }

  /**
   * Processes a call started event whose caller is the From the INVITE arrived
   * with. A Trunk with rewriteFromWithNumber presents the Number as the caller on
   * the way out, so the processor's reply carries the Number in From, but the
   * event names who actually placed the call.
   *
   * @param response The message response containing call information
   * @param caller The From of the INVITE as received
   */
  public void processCallStartedEvent(MessageResponse response, io.routr.message.From caller) {
    var startTime = ZonedDateTime.now(ZoneOffset.UTC)
        .truncatedTo(ChronoUnit.MILLIS)
        .format(DateTimeFormatter.ISO_INSTANT);
    var callId = response.getMessage().getCallId().getCallId();
    var from = (caller != null ? caller : response.getMessage().getFrom()).getAddress().getUri();
    var to = response.getMessage().getTo().getAddress().getUri();
    var callStartedEvent = new HashMap<String, Object>();

    callStartedEvent.put("callId", callId);
    callStartedEvent.put("from", "sip:" + from.getUser() + "@" + from.getHost());
    callStartedEvent.put("to", "sip:" + to.getUser() + "@" + to.getHost());
    callStartedEvent.put("startTime", startTime);
    callStartedEvent.put("extraHeaders", getExtraHeaders(response.getMessage()));
    callStartedEvent.putAll(response.getMetadataMap());

    publishEvent(EventTypes.CALL_STARTED.getType(), callStartedEvent);
  }

  /**
   * Processes a call ended event.
   * 
   * @param response The message response containing call information
   */
  public void processCallEndedEvent(MessageResponse response) {
    var endTime = ZonedDateTime.now(ZoneOffset.UTC)
        .truncatedTo(ChronoUnit.MILLIS)
        .format(DateTimeFormatter.ISO_INSTANT);
    var callId = response.getMessage().getCallId().getCallId();
    var callEndedEvent = new HashMap<String, Object>();
    var type = ResponseCode.valueOf(response.getMessage().getResponseType().name());

    int code = type.equals(ResponseCode.UNKNOWN) ? ResponseCode.OK.getCode() : type.getCode();
    var cause = HangupCauses.get(code);

    callEndedEvent.put("callId", callId);
    callEndedEvent.put("endTime", endTime);
    callEndedEvent.put("hangupCause", cause);
    callEndedEvent.put("extraHeaders", getExtraHeaders(response.getMessage()));

    publishEvent(EventTypes.CALL_ENDED.getType(), callEndedEvent);
  }

  /**
   * Processes a registration event.
   * 
   * @param request The message request containing registration information
   * @param expires The expiration time in seconds
   */
  public void processRegistrationEvent(MessageRequest request, int expires) {
    var registeredAt = ZonedDateTime.now(ZoneOffset.UTC)
        .truncatedTo(ChronoUnit.MILLIS)
        .format(DateTimeFormatter.ISO_INSTANT);
    var uri = request.getMessage().getFrom().getAddress().getUri();
    var registrationEvent = new HashMap<String, Object>();

    registrationEvent.put("aor", "sip:" + uri.getUser() + "@" + uri.getHost());
    registrationEvent.put("registeredAt", registeredAt);
    registrationEvent.put("expires", expires);
    registrationEvent.put("extraHeaders", getExtraHeaders(request.getMessage()));

    publishEvent(EventTypes.ENDPOINT_REGISTERED.getType(), registrationEvent);
  }

  /**
   * Extracts extra headers (X- headers) from a SIP message.
   * 
   * @param message The SIP message
   * @return Map of extra headers
   */
  private HashMap<String, String> getExtraHeaders(SIPMessage message) {
    var extraHeaders = new HashMap<String, String>();
    List<Extension> extensions = message.getExtensionsList();

    for (Extension extension : extensions) {
      String name = extension.getName();
      if (name.toLowerCase().startsWith("x-")) {
        String value = extension.getValue();
        extraHeaders.put(name, value);
      }
    }

    return extraHeaders;
  }

  /**
   * Publishes an event to all registered publishers.
   * 
   * @param eventName The event name
   * @param message The event message
   */
  private void publishEvent(String eventName, Map<String, Object> message) {
    publishers.forEach(publisher -> publisher.publish(eventName, message));
  }
}

