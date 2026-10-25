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
import opentelemetry, { Tracer, context, propagation } from "@opentelemetry/api"
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks"
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator
} from "@opentelemetry/core"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { GrpcInstrumentation } from "@opentelemetry/instrumentation-grpc"
import { WinstonInstrumentation } from "@opentelemetry/instrumentation-winston"
import { BatchSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace"
import {
  MeterProvider,
  PeriodicExportingMetricReader
} from "@opentelemetry/sdk-metrics"
import {
  BatchLogRecordProcessor,
  LoggerProvider
} from "@opentelemetry/sdk-logs"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"

type Signal = "traces" | "metrics" | "logs"

/**
 * Whether telemetry is on: an OTLP endpoint is configured and the SDK is not disabled.
 *
 * @param {NodeJS.ProcessEnv} env - The environment to read.
 * @return {boolean} True when traces, metrics and logs should be exported.
 */
export function tracingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.OTEL_SDK_DISABLED === "true") return false
  return !!(
    env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  )
}

/**
 * A signal's endpoint, as the OTLP exporters derive it from the environment: the
 * signal's own variable, else the base endpoint plus `/v1/<signal>`.
 *
 * @param {NodeJS.ProcessEnv} env - The environment to read.
 * @param {Signal} signal - traces, metrics or logs.
 * @return {string} The URL the signal is posted to.
 */
function signalUrl(env: NodeJS.ProcessEnv, signal: Signal): string {
  const own = env[`OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_ENDPOINT`]
  if (own) return own
  // With only a traces endpoint, the other signals go to the same collector.
  const base =
    env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.replace(/\/v1\/traces\/?$/, "")
  return `${base?.replace(/\/$/, "")}/v1/${signal}`
}

let providers: Array<{
  forceFlush(): Promise<void>
  shutdown(): Promise<void>
}> = []

/**
 * Starts telemetry for the service: traces, metrics and logs over OTLP/HTTP to the endpoint
 * in the standard OTEL_EXPORTER_OTLP_* variables. Without one it registers nothing and
 * returns a no-op tracer. Call it before anything loads @grpc/grpc-js or creates a logger,
 * so the gRPC instrumentation can propagate the W3C trace context between services and
 * every Winston logger also sends its records. Only the first call in a process starts
 * telemetry (Routr One loads several services).
 *
 * @param {string} serviceName - The service's name, unless OTEL_SERVICE_NAME is set.
 * @param {NodeJS.ProcessEnv} env - The environment to read.
 * @return {Tracer} The tracer object.
 */
export function init(
  serviceName: string,
  env: NodeJS.ProcessEnv = process.env
): Tracer {
  if (providers.length || !tracingEnabled(env))
    return opentelemetry.trace.getTracer("routr-tracer")

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME || serviceName
  })

  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable()
  )
  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()]
    })
  )

  const tracerProvider = new TracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor({
        exporter: new OTLPTraceExporter({ url: signalUrl(env, "traces") })
      })
    ]
  })
  opentelemetry.trace.setGlobalTracerProvider(tracerProvider)

  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: signalUrl(env, "metrics") }),
        exportIntervalMillis: Number(env.OTEL_METRIC_EXPORT_INTERVAL) || 15000
      })
    ]
  })
  opentelemetry.metrics.setGlobalMeterProvider(meterProvider)

  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: signalUrl(env, "logs") })
      })
    ]
  })
  opentelemetry.logs.setGlobalLoggerProvider(loggerProvider)

  providers = [tracerProvider, meterProvider, loggerProvider]

  registerInstrumentations({
    instrumentations: [new GrpcInstrumentation(), new WinstonInstrumentation()]
  })

  process.once("beforeExit", () => void shutdown())

  return opentelemetry.trace.getTracer("routr-tracer")
}

/**
 * Exports what is still buffered (spans, metrics, log records).
 *
 * @return {Promise<void>} Resolves once every signal was flushed.
 */
export async function flush(): Promise<void> {
  await Promise.all(providers.map((p) => p.forceFlush()))
}

/**
 * Flushes and stops every provider; a later init starts telemetry again.
 *
 * @return {Promise<void>} Resolves once every provider stopped.
 */
export async function shutdown(): Promise<void> {
  const stopping = providers
  providers = []
  await Promise.all(
    stopping.map((p) => p.shutdown().catch((): void => undefined))
  )
}
