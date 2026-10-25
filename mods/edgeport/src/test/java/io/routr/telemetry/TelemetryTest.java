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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.metrics.SdkMeterProvider;
import io.opentelemetry.sdk.metrics.data.MetricData;
import io.opentelemetry.sdk.testing.exporter.InMemoryMetricReader;
import io.opentelemetry.sdk.testing.exporter.InMemorySpanExporter;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import javax.sip.ServerTransaction;
import javax.sip.address.SipURI;
import javax.sip.header.CallIdHeader;
import javax.sip.header.Header;
import org.mockito.ArgumentCaptor;
import javax.sip.header.ViaHeader;
import javax.sip.message.Request;
import javax.sip.message.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TelemetryTest {
  private InMemorySpanExporter spans;
  private InMemoryMetricReader metrics;

  @BeforeEach
  void setUp() {
    spans = InMemorySpanExporter.create();
    metrics = InMemoryMetricReader.create();
    Telemetry.use(OpenTelemetrySdk.builder()
        .setTracerProvider(SdkTracerProvider.builder()
            .addSpanProcessor(SimpleSpanProcessor.create(spans)).build())
        .setMeterProvider(SdkMeterProvider.builder().registerMetricReader(metrics).build())
        .build());
    Telemetry.setInternalNetworks(List.of("10.0.0.0/8"));
  }

  @Test
  void isEnabledOnlyWithAnEndpoint() {
    assertFalse(Telemetry.enabled(Map.of()));
    assertFalse(Telemetry.enabled(Map.of("OTEL_EXPORTER_OTLP_ENDPOINT", "")));
    assertTrue(Telemetry.enabled(Map.of("OTEL_EXPORTER_OTLP_ENDPOINT", "http://c:4318")));
    assertFalse(Telemetry.enabled(Map.of("OTEL_EXPORTER_OTLP_ENDPOINT", "http://c:4318",
        "OTEL_SDK_DISABLED", "true")));
  }

  @Test
  void oneSpanPerServerTransactionEndedByTheFinalResponse() {
    var request = request("INVITE", "abc@host", "WSS");
    var transaction = mock(ServerTransaction.class);
    when(transaction.getRequest()).thenReturn(request);

    Telemetry.requestReceived(request, transaction, "10.0.0.7", 59288);
    Telemetry.responseSent(transaction, response(180));
    assertTrue(spans.getFinishedSpanItems().isEmpty());

    Telemetry.responseSent(transaction, response(200));
    var span = spans.getFinishedSpanItems().get(0);
    assertEquals("SIP INVITE", span.getName());
    assertEquals("abc@host", span.getAttributes().get(Telemetry.SIP_CALL_ID));
    assertEquals("wss", span.getAttributes().get(Telemetry.TRANSPORT));
    assertEquals(200L, span.getAttributes().get(Telemetry.SIP_STATUS));
    assertEquals(StatusCode.UNSET, span.getStatus().getStatusCode());
  }

  @Test
  void aRequestWithATraceparentJoinsThatTrace() {
    var request = request("BYE", "dialog-1", "UDP");
    var traceparent = mock(Header.class);
    when(traceparent.toString())
        .thenReturn("traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01\r\n");
    when(request.getHeader(Telemetry.TRACEPARENT)).thenReturn(traceparent);
    var transaction = mock(ServerTransaction.class);
    when(transaction.getRequest()).thenReturn(request);

    Telemetry.requestReceived(request, transaction, "10.0.0.9", 5060);
    Telemetry.responseSent(transaction, response(200));

    var span = spans.getFinishedSpanItems().get(0);
    assertEquals("0af7651916cd43dd8448eb211c80319c", span.getTraceId());
    assertEquals("b7ad6b7169203331", span.getParentSpanId());
  }

  @Test
  void aForwardedRequestCarriesTheSpansTraceparent() {
    var request = request("INVITE", "call-1", "WSS");
    var transaction = mock(ServerTransaction.class);
    when(transaction.getRequest()).thenReturn(request);
    var requestOut = requestTo("10.216.16.42");

    Telemetry.requestReceived(request, transaction, "10.0.0.7", 59288);
    Telemetry.forwarding(transaction, requestOut);
    Telemetry.responseSent(transaction, response(200));

    var header = ArgumentCaptor.forClass(Header.class);
    verify(requestOut).setHeader(header.capture());
    var span = spans.getFinishedSpanItems().get(0);
    assertEquals("traceparent: 00-" + span.getTraceId() + "-" + span.getSpanId() + "-"
        + span.getSpanContext().getTraceFlags().asHex(),
        header.getValue().toString().trim());
  }

  @Test
  void traceContextNeverLeavesForACarrierOrComesFromOne() {
    var request = request("INVITE", "call-2", "UDP");
    var traceparent = mock(Header.class);
    when(traceparent.toString())
        .thenReturn("traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01");
    when(request.getHeader(Telemetry.TRACEPARENT)).thenReturn(traceparent);
    var transaction = mock(ServerTransaction.class);
    when(transaction.getRequest()).thenReturn(request);
    var toCarrier = requestTo("203.0.113.9");

    Telemetry.requestReceived(request, transaction, "198.51.100.4", 5060);
    Telemetry.forwarding(transaction, toCarrier);
    Telemetry.responseSent(transaction, response(200));

    verify(toCarrier).removeHeader(Telemetry.TRACEPARENT);
    verify(toCarrier, never()).setHeader(org.mockito.ArgumentMatchers.any());
    var span = spans.getFinishedSpanItems().get(0);
    assertFalse(span.getParentSpanContext().isValid(), "joined a trace sent from outside");
  }

  @Test
  void aResponseThatWasNotSentEndsTheSpanAsAnError() {
    var request = request("BYE", "dialog-3", "WSS");
    var transaction = mock(ServerTransaction.class);
    when(transaction.getRequest()).thenReturn(request);

    Telemetry.requestReceived(request, transaction, "10.0.0.7", 59288);
    Telemetry.responseSent(transaction, response(200), false);

    var span = spans.getFinishedSpanItems().get(0);
    assertEquals(StatusCode.ERROR, span.getStatus().getStatusCode());
    assertEquals(0, sum("routr.sip.responses"));
  }

  @Test
  void aRetransmissionWithoutATransactionIsNotTraced() {
    Telemetry.requestReceived(request("INVITE", "call-4", "UDP"), null, "10.0.0.7", 5060);

    assertTrue(spans.getFinishedSpanItems().isEmpty());
    assertEquals(0, sum("routr.sip.requests"));
  }

  @Test
  void aRequestTheDispatcherFailedEndsAsAnError() {
    var request = request("OPTIONS", "call-5", "UDP");
    var transaction = mock(ServerTransaction.class);
    when(transaction.getRequest()).thenReturn(request);

    Telemetry.requestReceived(request, transaction, "10.0.0.7", 5060);
    Telemetry.failed(transaction, "StatusRuntimeException");

    assertEquals(StatusCode.ERROR, spans.getFinishedSpanItems().get(0).getStatus().getStatusCode());
  }

  @Test
  void spansOpenTooLongAreSwept() {
    var request = request("INFO", "call-6", "UDP");
    var transaction = mock(ServerTransaction.class);
    when(transaction.getRequest()).thenReturn(request);

    Telemetry.requestReceived(request, transaction, "10.0.0.7", 5060);
    Telemetry.sweep(System.nanoTime() + 6L * 60 * 1_000_000_000L);

    assertEquals(StatusCode.ERROR, spans.getFinishedSpanItems().get(0).getStatus().getStatusCode());
  }

  @Test
  void onlyLocalnetAddressesAreInternal() {
    assertTrue(Telemetry.isInternal("10.216.16.42"));
    assertFalse(Telemetry.isInternal("203.0.113.9"));
    assertFalse(Telemetry.isInternal("roomr.internal"));
    assertFalse(Telemetry.isInternal(null));
  }

  @Test
  void aForwardedRequestWithNoAnswerEndsAsATimeout() {
    var request = request("BYE", "dialog-1", "UDP");
    var transaction = mock(ServerTransaction.class);
    when(transaction.getRequest()).thenReturn(request);

    Telemetry.requestReceived(request, transaction, "10.0.0.9", 5060);
    Telemetry.timedOut(transaction, "BYE");
    Telemetry.terminated(transaction);

    assertEquals(1, spans.getFinishedSpanItems().size());
    var span = spans.getFinishedSpanItems().get(0);
    assertEquals(StatusCode.ERROR, span.getStatus().getStatusCode());
    assertEquals(1, sum("routr.sip.timeouts"));
  }

  @Test
  void aDroppedMessageIsCountedAndDescribed() {
    var bye = "BYE sip:abc@df7jal23ls0d.invalid;transport=ws SIP/2.0\r\n"
        + "Via: SIP/2.0/WSS 10.0.0.1;branch=z9hG4bK1\r\n"
        + "Call-ID: dialog-1\r\n\r\n";

    var description = Telemetry.dropped("ws_reconnect", "WSS",
        bye.getBytes(StandardCharsets.ISO_8859_1));

    assertEquals("firstLine=\"BYE sip:abc@df7jal23ls0d.invalid;transport=ws SIP/2.0\", "
        + "callId=dialog-1", description);
    assertEquals(1, sum("routr.sip.send_dropped"));
    assertEquals("firstLine=\"\", callId=none", Telemetry.dropped("send_timeout", "ws", null));
  }

  @Test
  void aDroppedTlsHandshakeIsNamedNotPrinted() {
    var clientHello = new byte[] {0x16, 0x03, 0x01, 0x00, (byte) 0xd3, 0x01};

    assertEquals("firstLine=\"<TLS handshake of a new outbound connection>\", callId=none",
        Telemetry.dropped("ws_reconnect", "WSS", clientHello));
    assertEquals(1, sum("routr.sip.send_dropped"));
  }

  private long sum(String name) {
    return metrics.collectAllMetrics().stream()
        .filter(m -> m.getName().equals(name))
        .map(MetricData::getLongSumData)
        .flatMap(d -> d.getPoints().stream())
        .mapToLong(p -> p.getValue())
        .sum();
  }

  private static Request request(String method, String callId, String transport) {
    var request = mock(Request.class);
    var callIdHeader = mock(CallIdHeader.class);
    var via = mock(ViaHeader.class);
    when(request.getMethod()).thenReturn(method);
    when(callIdHeader.getCallId()).thenReturn(callId);
    when(via.getTransport()).thenReturn(transport);
    when(request.getHeader(CallIdHeader.NAME)).thenReturn(callIdHeader);
    when(request.getHeader(ViaHeader.NAME)).thenReturn(via);
    return request;
  }

  private static Request requestTo(String host) {
    var request = mock(Request.class);
    var uri = mock(SipURI.class);
    when(uri.getHost()).thenReturn(host);
    when(request.getRequestURI()).thenReturn(uri);
    return request;
  }

  private static Response response(int status) {
    var response = mock(Response.class);
    when(response.getStatusCode()).thenReturn(status);
    when(response.getReasonPhrase()).thenReturn("reason");
    return response;
  }
}
