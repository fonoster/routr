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
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
  Sampler,
  TraceIdRatioBasedSampler
} from "@opentelemetry/sdk-trace"

const DEFAULT_SAMPLER = "parentbased_always_on"

/**
 * The trace sampler named by the standard OTEL_TRACES_SAMPLER and
 * OTEL_TRACES_SAMPLER_ARG variables, as the OpenTelemetry specification defines
 * them (and as the EdgePort's Java SDK reads them): always_on, always_off,
 * traceidratio, parentbased_always_on (the default), parentbased_always_off and
 * parentbased_traceidratio. The ratio is a number from 0 to 1 and defaults to 1.
 * An unknown sampler or a bad ratio falls back to the default with a warning, so
 * a typo never stops a service.
 *
 * @param {NodeJS.ProcessEnv} env - The environment to read.
 * @param {Function} warn - Receives a message for each value that was ignored.
 * @return {Sampler} The sampler for the tracer provider.
 */
export function samplerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = (message) => process.emitWarning(message)
): Sampler {
  const name = (
    env.OTEL_TRACES_SAMPLER?.trim() || DEFAULT_SAMPLER
  ).toLowerCase()

  const ratio = (): number => {
    const arg = env.OTEL_TRACES_SAMPLER_ARG?.trim()
    if (!arg) return 1
    const value = Number(arg)
    if (Number.isFinite(value) && value >= 0 && value <= 1) return value
    warn(
      `OTEL_TRACES_SAMPLER_ARG "${arg}" is not a number from 0 to 1; using 1`
    )
    return 1
  }

  switch (name) {
    case "always_on":
      return new AlwaysOnSampler()
    case "always_off":
      return new AlwaysOffSampler()
    case "traceidratio":
      return new TraceIdRatioBasedSampler(ratio())
    case "parentbased_always_on":
      return new ParentBasedSampler({ root: new AlwaysOnSampler() })
    case "parentbased_always_off":
      return new ParentBasedSampler({ root: new AlwaysOffSampler() })
    case "parentbased_traceidratio":
      return new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(ratio())
      })
    default:
      warn(
        `OTEL_TRACES_SAMPLER "${name}" is not supported; using ${DEFAULT_SAMPLER}`
      )
      return new ParentBasedSampler({ root: new AlwaysOnSampler() })
  }
}
