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
package io.routr.telemetry;

import static io.opentelemetry.api.common.AttributeKey.longKey;
import static io.opentelemetry.api.common.AttributeKey.stringKey;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.instrumentation.log4j.appender.v2_17.OpenTelemetryAppender;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.autoconfigure.AutoConfiguredOpenTelemetrySdk;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.sip.Transaction;
import javax.sip.header.CallIdHeader;
import javax.sip.header.ViaHeader;
import javax.sip.message.Request;
import javax.sip.message.Response;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

/**
 * EdgePort's OpenTelemetry signals: one span per SIP server transaction, SIP counters, and
 * Log4j2 records, all over OTLP to the endpoint in the standard {@code OTEL_*} variables.
 * Without an endpoint (or with {@code OTEL_SDK_DISABLED=true}) nothing is loaded and every
 * method is a no-op.
 *
 * <p>A span starts when a request arrives and ends when EdgePort answers it with a final
 * response, when the transaction times out, or when it terminates. Every span and counter
 * carries {@code sip.method} and, for spans, {@code sip.call_id}, so a SIP dialog can be
 * found next to the Roomr node's call span, which carries both {@code sip.call_id} and
 * {@code fonoster.call_ref}.
 */
public final class Telemetry {
  private static final Logger LOG = LogManager.getLogger(Telemetry.class);
  private static final String SCOPE = "io.routr.edgeport";

  public static final AttributeKey<String> SIP_METHOD = stringKey("sip.method");
  public static final AttributeKey<String> SIP_CALL_ID = stringKey("sip.call_id");
  public static final AttributeKey<Long> SIP_STATUS = longKey("sip.status_code");
  public static final AttributeKey<String> TRANSPORT = stringKey("network.transport");
  public static final AttributeKey<String> PEER_ADDRESS = stringKey("network.peer.address");
  public static final AttributeKey<Long> PEER_PORT = longKey("network.peer.port");
  public static final AttributeKey<String> DROP_REASON = stringKey("routr.drop.reason");

  private static final Map<Transaction, Span> SPANS = new ConcurrentHashMap<>();

  private static volatile Tracer tracer = OpenTelemetry.noop().getTracer(SCOPE);
  private static volatile LongCounter requests;
  private static volatile LongCounter responses;
  private static volatile LongCounter timeouts;
  private static volatile LongCounter dropped;
  private static volatile LongCounter transportErrors;
  private static OpenTelemetrySdk sdk;

  static {
    counters(OpenTelemetry.noop().getMeter(SCOPE));
  }

  private Telemetry() {
  }

  /**
   * Whether telemetry is on: an OTLP endpoint is set and the SDK is not disabled.
   */
  static boolean enabled(Map<String, String> env) {
    if ("true".equalsIgnoreCase(env.get("OTEL_SDK_DISABLED"))) {
      return false;
    }
    return !blank(env.get("OTEL_EXPORTER_OTLP_ENDPOINT"))
        || !blank(env.get("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"));
  }

  /**
   * Starts telemetry from the environment. Only the first call does anything.
   *
   * @param serviceName the service.name, unless OTEL_SERVICE_NAME is set
   */
  public static synchronized void init(String serviceName) {
    init(serviceName, System.getenv());
  }

  static synchronized void init(String serviceName, Map<String, String> env) {
    if (sdk != null || !enabled(env)) {
      return;
    }
    sdk = AutoConfiguredOpenTelemetrySdk.builder()
        // Defaults; the environment and system properties win.
        .addPropertiesSupplier(() -> Map.of(
            "otel.service.name", serviceName,
            "otel.metric.export.interval", "15000"))
        // Compose passes unset variables as empty strings, which autoconfigure rejects.
        .addPropertiesCustomizer(config -> {
          var fixed = new HashMap<String, String>();
          if (blank(config.getString("otel.exporter.otlp.protocol"))) {
            fixed.put("otel.exporter.otlp.protocol", "http/protobuf");
          }
          return fixed;
        })
        .setResultAsGlobal()
        .build()
        .getOpenTelemetrySdk();
    OpenTelemetryAppender.install(sdk);
    tracer = sdk.getTracer(SCOPE);
    counters(sdk.getMeter(SCOPE));
    Runtime.getRuntime().addShutdownHook(new Thread(sdk::close));
    LOG.info("telemetry on: traces, metrics and logs go over OTLP");
  }

  /**
   * Uses the given OpenTelemetry instead of the environment's (tests).
   */
  static synchronized void use(OpenTelemetry otel) {
    SPANS.clear();
    tracer = otel.getTracer(SCOPE);
    counters(otel.getMeter(SCOPE));
  }

  private static void counters(Meter meter) {
    requests = meter.counterBuilder("routr.sip.requests")
        .setDescription("SIP requests EdgePort received").build();
    responses = meter.counterBuilder("routr.sip.responses")
        .setDescription("Final SIP responses EdgePort sent").build();
    timeouts = meter.counterBuilder("routr.sip.timeouts")
        .setDescription("SIP transactions that timed out").build();
    dropped = meter.counterBuilder("routr.sip.send_dropped")
        .setDescription("SIP messages EdgePort dropped instead of sending").build();
    transportErrors = meter.counterBuilder("routr.sip.transport_errors")
        .setDescription("Transport errors JAIN-SIP reported").build();
  }

  /**
   * A request arrived. Starts the span of its server transaction; a request without one
   * (an ACK) gets a span that ends right away.
   */
  public static void requestReceived(Request request, Transaction serverTransaction,
      String peerAddress, int peerPort) {
    var method = request.getMethod();
    var transport = transportOf(request);
    requests.add(1, Attributes.of(SIP_METHOD, method, TRANSPORT, transport));

    var span = tracer.spanBuilder("SIP " + method)
        .setSpanKind(SpanKind.SERVER)
        .setAttribute(SIP_METHOD, method)
        .setAttribute(SIP_CALL_ID, callIdOf(request))
        .setAttribute(TRANSPORT, transport)
        .setAttribute(PEER_ADDRESS, peerAddress != null ? peerAddress : "")
        .setAttribute(PEER_PORT, (long) peerPort)
        .startSpan();
    if (serverTransaction == null) {
      span.end();
      return;
    }
    var previous = SPANS.put(serverTransaction, span);
    if (previous != null) {
      previous.end();
    }
  }

  /**
   * A response went out on a server transaction. A final response ends its span.
   */
  public static void responseSent(Transaction serverTransaction, Response response) {
    var status = response.getStatusCode();
    if (status < 200) {
      return;
    }
    var method = serverTransaction != null && serverTransaction.getRequest() != null
        ? serverTransaction.getRequest().getMethod()
        : "";
    responses.add(1, Attributes.of(SIP_METHOD, method, SIP_STATUS, (long) status));
    var span = serverTransaction != null ? SPANS.remove(serverTransaction) : null;
    if (span == null) {
      return;
    }
    span.setAttribute(SIP_STATUS, (long) status);
    if (status >= 500 || status == Response.REQUEST_TIMEOUT) {
      span.setStatus(StatusCode.ERROR, response.getReasonPhrase());
    }
    span.end();
  }

  /**
   * A transaction timed out. Ends the span of the server transaction it belongs to, as an
   * error: the request never got a final response.
   *
   * @param serverTransaction the server transaction (or the one a client transaction was
   *     forwarding for); may be null
   * @param method the timed out request's method
   */
  public static void timedOut(Transaction serverTransaction, String method) {
    timeouts.add(1, Attributes.of(SIP_METHOD, method));
    var span = serverTransaction != null ? SPANS.remove(serverTransaction) : null;
    if (span != null) {
      span.setStatus(StatusCode.ERROR, "timeout: no final response");
      span.end();
    }
  }

  /**
   * A transaction terminated. Ends its span if nothing ended it before.
   */
  public static void terminated(Transaction transaction) {
    var span = transaction != null ? SPANS.remove(transaction) : null;
    if (span != null) {
      span.end();
    }
  }

  /**
   * EdgePort dropped a message instead of sending it. Counts it and returns a one-line
   * description (first line and Call-ID) for the caller's log record.
   */
  public static String dropped(String reason, String transport, byte[] message) {
    // A TLS record (handshake 0x16, version 0x03): EdgePort was opening a new connection to the
    // peer, so whatever it meant to send there is lost with it.
    if (message != null && message.length > 1 && message[0] == 0x16 && message[1] == 0x03) {
      dropped.add(1, Attributes.of(DROP_REASON, reason, TRANSPORT, lower(transport),
          SIP_METHOD, "tls_handshake"));
      return "firstLine=\"<TLS handshake of a new outbound connection>\", callId=none";
    }
    var text = message != null
        ? new String(message, StandardCharsets.ISO_8859_1)
        : "";
    var firstLine = text.lines().findFirst().orElse("");
    var method = firstLine.contains(" SIP/2.0") && !firstLine.startsWith("SIP/2.0")
        ? firstLine.substring(0, firstLine.indexOf(' '))
        : firstLine.startsWith("SIP/2.0") ? "response" : "other";
    dropped.add(1, Attributes.of(DROP_REASON, reason, TRANSPORT, lower(transport),
        SIP_METHOD, method));
    var callId = text.lines()
        .filter(l -> l.regionMatches(true, 0, "Call-ID:", 0, 8)
            || l.regionMatches(true, 0, "i:", 0, 2))
        .map(l -> l.substring(l.indexOf(':') + 1).trim())
        .findFirst().orElse("");
    return "firstLine=\"" + firstLine + "\", callId=" + (callId.isEmpty() ? "none" : callId);
  }

  /**
   * JAIN-SIP reported a transport error.
   */
  public static void transportError(String transport) {
    transportErrors.add(1, Attributes.of(TRANSPORT, lower(transport)));
  }

  private static String transportOf(Request request) {
    var via = (ViaHeader) request.getHeader(ViaHeader.NAME);
    return via != null && via.getTransport() != null ? lower(via.getTransport()) : "";
  }

  private static String callIdOf(Request request) {
    var callId = (CallIdHeader) request.getHeader(CallIdHeader.NAME);
    return callId != null ? callId.getCallId() : "";
  }

  private static String lower(String s) {
    return s != null ? s.toLowerCase() : "";
  }

  private static boolean blank(String s) {
    return s == null || s.isBlank();
  }
}
