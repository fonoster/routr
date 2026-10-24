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
import { TRACE_FLAG_METADATA_KEY, TRACE_METADATA_PREFIX } from "./types"

export interface SplitMetadata {
  // trace.* keys other than the flag, prefix removed: hop annotations
  hop: Record<string, string>
  // Everything that is not a trace.* key: what the EdgePort may see
  rest: Record<string, string>
  // Value of trace.record, when a processor asked for the recording
  flag?: string
}

/**
 * Separates the trace keys a component put in its response metadata from
 * the metadata that continues to the EdgePort.
 *
 * @param {Record<string, string>} metadata - Response metadata, if any
 * @return {SplitMetadata} Annotations, remaining metadata and the flag
 */
export function splitTraceMetadata(
  metadata?: Record<string, string>
): SplitMetadata {
  const hop: Record<string, string> = {}
  const rest: Record<string, string> = {}
  let flag: string | undefined

  Object.entries(metadata ?? {}).forEach(([key, value]) => {
    if (key === TRACE_FLAG_METADATA_KEY) {
      flag = value
    } else if (key.startsWith(TRACE_METADATA_PREFIX)) {
      hop[key.slice(TRACE_METADATA_PREFIX.length)] = value
    } else {
      rest[key] = value
    }
  })

  return { hop, rest, ...(flag !== undefined ? { flag } : {}) }
}

/**
 * Returns the metadata without any trace.* key, or undefined when nothing
 * is left.
 *
 * @param {Record<string, string>} metadata - Response metadata, if any
 * @return {Record<string, string> | undefined} Metadata for the EdgePort
 */
export function withoutTraceMetadata(
  metadata?: Record<string, string>
): Record<string, string> | undefined {
  if (!metadata) return undefined
  const { rest } = splitTraceMetadata(metadata)
  return rest
}

/**
 * Builds the metadata a processor returns to annotate its hop in the trace.
 *
 * @param {Record<string, string | number | undefined>} annotations - Keys without the prefix
 * @return {Record<string, string>} Metadata entries, prefix added, undefined values skipped
 */
export function traceAnnotations(
  annotations: Record<string, string | number | undefined>
): Record<string, string> {
  const out: Record<string, string> = {}
  Object.entries(annotations).forEach(([key, value]) => {
    if (value !== undefined) out[TRACE_METADATA_PREFIX + key] = String(value)
  })
  return out
}
