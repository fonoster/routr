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
import opentelemetry from "@opentelemetry/api"
import { init, flush, shutdown, tracingEnabled } from "../src/tracer"

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

  it("exports the service's spans, metrics and logs over OTLP/HTTP, starting only once", async () => {
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
      opentelemetry.metrics
        .getMeter("test")
        .createCounter("routr.test.lookups")
        .add(1)
      opentelemetry.logs.getLogger("test").emit({ body: "a lookup" })

      await flush()

      const sent = (path: string) => {
        const body = bodies.find((b) => b.startsWith(`${path} `))
        expect(body, path).to.not.be.undefined
        return JSON.parse((body as string).replace(/^\S+ /, ""))
      }
      const [resourceSpans] = sent("/v1/traces").resourceSpans
      const serviceName = resourceSpans.resource.attributes.find(
        (a: { key: string }) => a.key === "service.name"
      ).value.stringValue
      expect(serviceName).to.equal("location")
      expect(resourceSpans.scopeSpans[0].spans[0].name).to.equal("lookup")
      expect(JSON.stringify(sent("/v1/metrics"))).to.contain(
        "routr.test.lookups"
      )
      expect(JSON.stringify(sent("/v1/logs"))).to.contain("a lookup")
    } finally {
      await shutdown()
      opentelemetry.trace.disable()
      opentelemetry.metrics.disable()
      opentelemetry.logs.disable()
      server.close()
    }
  })
})
