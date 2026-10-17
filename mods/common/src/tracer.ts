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
import opentelemetry, { Tracer } from "@opentelemetry/api"
import { registerInstrumentations } from "@opentelemetry/instrumentation"
import { GrpcInstrumentation } from "@opentelemetry/instrumentation-grpc"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

/**
 * Whether tracing is on: an OTLP endpoint is configured and the SDK is not disabled.
 *
 * @param {NodeJS.ProcessEnv} env - The environment to read.
 * @return {boolean} True when spans should be exported.
 */
export function tracingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.OTEL_SDK_DISABLED === "true") return false
  return !!(
    env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  )
}

/**
 * The traces endpoint, as the OTLP exporter would derive it from process.env.
 *
 * @param {NodeJS.ProcessEnv} env - The environment to read.
 * @return {string} The URL spans are posted to.
 */
function tracesUrl(env: NodeJS.ProcessEnv): string {
  if (env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT)
    return env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  return `${env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "")}/v1/traces`
}

let started = false

/**
 * Starts tracing for the service, exporting spans over OTLP/HTTP to the endpoint in the
 * standard OTEL_EXPORTER_OTLP_* variables. Without one it registers nothing and returns a
 * no-op tracer. Call it before anything loads @grpc/grpc-js, so the gRPC instrumentation
 * can propagate the W3C trace context between services. Only the first call in a process
 * starts tracing (Routr One loads several services).
 *
 * @param {string} serviceName - The service's name, unless OTEL_SERVICE_NAME is set.
 * @param {NodeJS.ProcessEnv} env - The environment to read.
 * @return {Tracer} The tracer object.
 */
export function init(
  serviceName: string,
  env: NodeJS.ProcessEnv = process.env
): Tracer {
  if (started || !tracingEnabled(env))
    return opentelemetry.trace.getTracer("routr-tracer")
  started = true

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME || serviceName
    }),
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter({ url: tracesUrl(env) }))
    ]
  })
  provider.register()

  registerInstrumentations({
    instrumentations: [new GrpcInstrumentation()]
  })

  return opentelemetry.trace.getTracer("routr-tracer")
}
