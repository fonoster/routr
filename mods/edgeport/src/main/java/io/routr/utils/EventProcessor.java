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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.LongSupplier;

/**
 * Processes and publishes SIP events.
 */
public class EventProcessor {
  static final int MAX_STARTED_CALLS = 50_000;
  static final long STARTED_CALL_TTL_MILLIS = 24 * 60 * 60 * 1000L;

  private final List<EventsPublisher> publishers;
  private final int maxStartedCalls;
  private final long startedCallTtlMillis;
  private final LongSupplier clock;

  /**
   * The extra headers each call.started event carried, keyed by call ID, so the
   * matching call.ended carries them too. Endpoints do not echo the INVITE's X-
   * headers on the BYE or CANCEL that ends the dialog, and the transport-error
   * cleanup path has no SIP message to read them from at all.
   *
   * Released when call.ended is published. A call that never ends cleanly would
   * otherwise stay here for the life of the process, so entries also expire after a
   * TTL and the oldest is dropped past a size cap. Insertion-ordered, so the eldest
   * entry is always the first one to expire.
   */
  private final LinkedHashMap<String, StartedCall> startedCalls = new LinkedHashMap<>();

  private record StartedCall(long startedAt, Map<String, String> extraHeaders) {
  }

  public EventProcessor(List<EventsPublisher> publishers) {
    this(publishers, MAX_STARTED_CALLS, STARTED_CALL_TTL_MILLIS, System::currentTimeMillis);
  }

  EventProcessor(List<EventsPublisher> publishers, int maxStartedCalls, long startedCallTtlMillis,
      LongSupplier clock) {
    this.publishers = publishers;
    this.maxStartedCalls = maxStartedCalls;
    this.startedCallTtlMillis = startedCallTtlMillis;
    this.clock = clock;
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
    var extraHeaders = getExtraHeaders(response.getMessage());

    callStartedEvent.put("callId", callId);
    callStartedEvent.put("from", "sip:" + from.getUser() + "@" + from.getHost());
    callStartedEvent.put("to", "sip:" + to.getUser() + "@" + to.getHost());
    callStartedEvent.put("startTime", startTime);
    callStartedEvent.put("extraHeaders", extraHeaders);
    callStartedEvent.putAll(response.getMetadataMap());

    rememberStartedCall(callId, extraHeaders);
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
    callEndedEvent.put("extraHeaders", endedCallHeaders(callId, response.getMessage()));

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
   * Records the extra headers of a call.started event. An INVITE repeated on the same
   * call (an authentication retry or a re-INVITE) adds to the headers already
   * recorded rather than replacing them, so it cannot drop a correlation header the
   * first INVITE carried.
   *
   * @param callId The call ID
   * @param extraHeaders The extra headers the call.started event carried
   */
  private synchronized void rememberStartedCall(String callId, Map<String, String> extraHeaders) {
    var now = clock.getAsLong();
    var eldest = startedCalls.values().iterator();
    while (eldest.hasNext() && now - eldest.next().startedAt() >= startedCallTtlMillis) {
      eldest.remove();
    }

    var previous = startedCalls.get(callId);
    var merged = new HashMap<String, String>();
    if (previous != null) {
      merged.putAll(previous.extraHeaders());
    }
    merged.putAll(extraHeaders);
    startedCalls.put(callId, new StartedCall(previous != null ? previous.startedAt() : now, merged));

    if (startedCalls.size() > maxStartedCalls) {
      startedCalls.remove(startedCalls.keySet().iterator().next());
    }
  }

  /**
   * The extra headers for a call.ended event: those of the call.started event for the
   * same call, overridden by any the ending message carries itself. Releases the
   * recorded headers, since nothing follows call.ended on a call.
   *
   * @param callId The call ID
   * @param message The message that ended the call
   * @return Map of extra headers
   */
  private synchronized HashMap<String, String> endedCallHeaders(String callId, SIPMessage message) {
    var extraHeaders = new HashMap<String, String>();
    var started = startedCalls.remove(callId);
    if (started != null && clock.getAsLong() - started.startedAt() < startedCallTtlMillis) {
      extraHeaders.putAll(started.extraHeaders());
    }
    extraHeaders.putAll(getExtraHeaders(message));
    return extraHeaders;
  }

  /**
   * Whether extra headers are still recorded for a call.
   *
   * @param callId The call ID
   * @return true if a call.started was seen and its call.ended was not
   */
  synchronized boolean hasStartedCall(String callId) {
    return startedCalls.containsKey(callId);
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

