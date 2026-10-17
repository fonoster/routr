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
import chai from "chai"
import http from "http"
import { AddressInfo } from "net"
import opentelemetry, { ProxyTracerProvider } from "@opentelemetry/api"
import { init, tracingEnabled } from "../src/tracer"

const expect = chai.expect

describe("@routr/common/tracer", () => {
  it("is enabled only with an OTLP endpoint and the SDK not disabled", () => {
    expect(tracingEnabled({})).to.be.false
    expect(tracingEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://c:4318" })).to
      .be.true
    expect(
      tracingEnabled({ OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://c:4318/t" })
    ).to.be.true
    expect(
      tracingEnabled({
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://c:4318",
        OTEL_SDK_DISABLED: "true"
      })
    ).to.be.false
  })

  it("returns a no-op tracer without an endpoint", () => {
    const span = init("location", {}).startSpan("noop")
    expect(span.isRecording()).to.be.false
    span.end()
  })

  it("exports the service's spans over OTLP/HTTP, starting only once", async () => {
    const bodies: string[] = []
    const server = http.createServer((req, res) => {
      let body = ""
      req.on("data", (c) => (body += c))
      req.on("end", () => {
        bodies.push(`${req.url} ${body}`)
        res.end("{}")
      })
    })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const { port } = server.address() as AddressInfo

    try {
      const env = { OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${port}` }
      const tracer = init("location", env)
      // A second call (Routr One loads several services) keeps the first registration
      init("dispatcher", env)
      tracer.startSpan("lookup").end()

      const provider = (
        opentelemetry.trace.getTracerProvider() as ProxyTracerProvider
      ).getDelegate() as unknown as {
        forceFlush(): Promise<void>
        shutdown(): Promise<void>
      }
      await provider.forceFlush()

      expect(bodies).to.have.lengthOf(1)
      expect(bodies[0]).to.match(/^\/v1\/traces /)
      const [resourceSpans] = JSON.parse(
        bodies[0].replace(/^\S+ /, "")
      ).resourceSpans
      const serviceName = resourceSpans.resource.attributes.find(
        (a: { key: string }) => a.key === "service.name"
      ).value.stringValue
      expect(serviceName).to.equal("location")
      expect(resourceSpans.scopeSpans[0].spans[0].name).to.equal("lookup")
      await provider.shutdown()
    } finally {
      opentelemetry.trace.disable()
      server.close()
    }
  })
})
