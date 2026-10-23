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
import Ajv from "ajv"
import { readFileSync } from "fs"
import { traceRecordSchema } from "./schema"
import { SUPPORTED_TRACE_VERSIONS, TraceRecord } from "./types"

const ajv = new Ajv({ allErrors: true })
const validateSchema = ajv.compile(traceRecordSchema)

/**
 * Thrown when a trace line is not valid JSON or does not match the schema.
 */
export class TraceValidationError extends Error {
  readonly line?: number

  /**
   * @param {string} message - Human readable description
   * @param {number} line - 1-based line number in the trace file, if known
   */
  constructor(message: string, line?: number) {
    super(line ? `line ${line}: ${message}` : message)
    this.name = "TraceValidationError"
    this.line = line
  }
}

/**
 * Thrown when a record declares a traceVersion this build does not read.
 */
export class UnsupportedTraceVersionError extends TraceValidationError {
  readonly version: unknown

  /**
   * @param {unknown} version - The version found in the record
   * @param {number} line - 1-based line number in the trace file, if known
   */
  constructor(version: unknown, line?: number) {
    super(
      `trace version ${JSON.stringify(version)} is not supported ` +
        `(this build reads ${SUPPORTED_TRACE_VERSIONS.join(", ")}); ` +
        "upgrade rctl to read this file",
      line
    )
    this.name = "UnsupportedTraceVersionError"
    this.version = version
  }
}

/**
 * Checks the version before anything else, so a newer file fails with a
 * version message rather than with a list of unknown fields.
 *
 * @param {unknown} input - A parsed JSON value
 * @param {number} line - 1-based line number, if known
 */
export function assertSupportedVersion(input: unknown, line?: number): void {
  const version = (input as { traceVersion?: unknown })?.traceVersion
  if (!SUPPORTED_TRACE_VERSIONS.includes(version as number)) {
    throw new UnsupportedTraceVersionError(version, line)
  }
}

/**
 * Validates one parsed record against the schema and returns it typed.
 *
 * @param {unknown} input - A parsed JSON value
 * @param {number} line - 1-based line number, if known
 * @return {TraceRecord} The same object, now known to be a TraceRecord
 */
export function validateRecord(input: unknown, line?: number): TraceRecord {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TraceValidationError("record is not a JSON object", line)
  }

  assertSupportedVersion(input, line)

  if (!validateSchema(input)) {
    const first = validateSchema.errors?.[0] as
      | { instancePath?: string; dataPath?: string; message?: string }
      | undefined
    // ajv 6 reports dataPath (".outcome"), ajv 8 instancePath ("/outcome")
    const where = (first?.instancePath || first?.dataPath || "/")
      .replace(/^\./, "/")
      .replace(/\./g, "/")
    throw new TraceValidationError(`${where} ${first?.message}`, line)
  }

  return input as TraceRecord
}

/**
 * Parses the text of a trace file (one JSON record per line).
 *
 * Every line is validated. Blank lines are skipped. A truncated last line
 * is reported as an error, never silently dropped.
 *
 * @param {string} text - File contents
 * @return {TraceRecord[]} The records in file order
 */
export function parseTrace(text: string): TraceRecord[] {
  return text
    .split("\n")
    .map((raw, index) => ({ raw: raw.trim(), line: index + 1 }))
    .filter(({ raw }) => raw.length > 0)
    .map(({ raw, line }) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (e) {
        throw new TraceValidationError(
          `invalid JSON (${(e as Error).message})`,
          line
        )
      }
      return validateRecord(parsed, line)
    })
}

/**
 * Reads and validates a trace file.
 *
 * @param {string} path - Path to a .jsonl trace file
 * @return {TraceRecord[]} The records in file order
 */
export function readTrace(path: string): TraceRecord[] {
  const records = parseTrace(readFileSync(path, "utf8"))
  if (records.length === 0) {
    throw new TraceValidationError("file has no records")
  }
  return records
}
