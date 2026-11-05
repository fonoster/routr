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
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { ROOT_CONTEXT, SpanKind, TraceFlags, trace } from "@opentelemetry/api"
import { SamplingDecision } from "@opentelemetry/sdk-trace"
import { samplerFromEnv } from "../src/sampler_from_env"

const expect = chai.expect
chai.use(sinonChai)

const ids = Array.from({ length: 2000 }, (_, i) =>
  // Spread the low 32 bits, which TraceIdRatioBasedSampler reads, over the range.
  (((i + 1) * 2654435761) >>> 0).toString(16).padStart(32, "0")
)

const sampledFraction = (
  env: NodeJS.ProcessEnv,
  context = ROOT_CONTEXT
): number => {
  const sampler = samplerFromEnv(env, () => undefined)
  const sampled = ids.filter(
    (id) =>
      sampler.shouldSample(context, id, "s", SpanKind.SERVER, {}, [])
        .decision === SamplingDecision.RECORD_AND_SAMPLED
  )
  return sampled.length / ids.length
}

const withParent = (sampled: boolean) =>
  trace.setSpanContext(ROOT_CONTEXT, {
    traceId: "0af7651916cd43dd8448eb211c80319c",
    spanId: "b7ad6b7169203331",
    traceFlags: sampled ? TraceFlags.SAMPLED : TraceFlags.NONE,
    isRemote: true
  })

describe("@routr/common/sampler_from_env", () => {
  it("samples every root span by default", () => {
    expect(sampledFraction({})).to.equal(1)
  })

  it("samples the OTEL_TRACES_SAMPLER_ARG ratio of root spans with parentbased_traceidratio", () => {
    const fraction = sampledFraction({
      OTEL_TRACES_SAMPLER: "parentbased_traceidratio",
      OTEL_TRACES_SAMPLER_ARG: "0.01"
    })
    expect(fraction).to.be.within(0.005, 0.02)
  })

  it("follows the parent's decision with parentbased_traceidratio", () => {
    const env = {
      OTEL_TRACES_SAMPLER: "parentbased_traceidratio",
      OTEL_TRACES_SAMPLER_ARG: "0.01"
    }
    expect(sampledFraction(env, withParent(true))).to.equal(1)
    expect(sampledFraction(env, withParent(false))).to.equal(0)
  })

  it("supports always_on, always_off, traceidratio and parentbased_always_off", () => {
    expect(sampledFraction({ OTEL_TRACES_SAMPLER: "always_on" })).to.equal(1)
    expect(sampledFraction({ OTEL_TRACES_SAMPLER: "always_off" })).to.equal(0)
    expect(
      sampledFraction({
        OTEL_TRACES_SAMPLER: "traceidratio",
        OTEL_TRACES_SAMPLER_ARG: "0.5"
      })
    ).to.be.within(0.45, 0.55)
    // traceidratio ignores the parent
    expect(
      sampledFraction(
        { OTEL_TRACES_SAMPLER: "traceidratio", OTEL_TRACES_SAMPLER_ARG: "0" },
        withParent(true)
      )
    ).to.equal(0)
    expect(
      sampledFraction({ OTEL_TRACES_SAMPLER: "parentbased_always_off" })
    ).to.equal(0)
  })

  it("falls back with a warning on an unknown sampler or a bad ratio", () => {
    const warn = sinon.spy()
    samplerFromEnv({ OTEL_TRACES_SAMPLER: "sometimes" }, warn)
    expect(warn).to.have.been.calledOnceWith(
      sinon.match("is not supported; using parentbased_always_on")
    )
    expect(sampledFraction({ OTEL_TRACES_SAMPLER: "sometimes" })).to.equal(1)

    const badRatio = sinon.spy()
    samplerFromEnv(
      { OTEL_TRACES_SAMPLER: "traceidratio", OTEL_TRACES_SAMPLER_ARG: "1.5" },
      badRatio
    )
    expect(badRatio).to.have.been.calledOnceWith(
      sinon.match("is not a number from 0 to 1; using 1")
    )
    expect(
      sampledFraction({
        OTEL_TRACES_SAMPLER: "traceidratio",
        OTEL_TRACES_SAMPLER_ARG: "abc"
      })
    ).to.equal(1)
  })
})
