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
import { promises as fs, mkdirSync } from "fs"
import { join } from "path"
import { getLogger } from "@fonoster/logger"
import { CommonTypes as CT, MessageRequest, Trace } from "@routr/common"
import { HopCollector } from "./collector"
import { LintConfig, RecordingConfig, RecordingMode } from "./types"

const logger = getLogger({ service: "dispatcher", filePath: __filename })

// eslint-disable-next-line @typescript-eslint/no-var-requires
const DISPATCHER_VERSION: string = require("../../package.json").version

const DEFAULTS = {
  mode: RecordingMode.FLAGGED,
  maxRecordsPerCall: 1000,
  maxCalls: 10000,
  idleTimeoutSeconds: 7200,
  redact: true,
  sweepIntervalMs: 60000
}

const DEFAULT_LINT_WINDOW = 32

interface Session {
  file: string
  seq: number
  startedAt: number
  lastSeenAt: number
  trunkRef?: string
  // Serializes appends so records land in the order they were produced
  queue: Promise<void>
  // Most recent records of the call, for call-scope rules (lint only)
  recent: Trace.TraceRecord[]
}

export interface RecorderDeps {
  appendFile?: (path: string, data: string) => Promise<void>
  now?: () => number
}

/**
 * Writes one JSONL file per recorded call.
 *
 * In "flagged" mode a call is recorded from the first message a processor
 * marks (the connect processor marks calls whose trunk asks for it) until
 * the call has been idle for idleTimeoutSeconds. In "all" mode every call
 * is recorded. Writing never blocks or fails message processing: errors
 * are logged and the message continues on its way.
 */
export class Recorder {
  private readonly config: Omit<Required<RecordingConfig>, "lint"> & {
    lint?: LintConfig
  }
  private readonly sessions = new Map<string, Session>()
  private readonly appendFile: (path: string, data: string) => Promise<void>
  private readonly now: () => number
  private readonly ref: string
  private dropped = 0

  /**
   * @param {string} ref - The dispatcher ref, written into every record
   * @param {RecordingConfig} config - Recording configuration
   * @param {RecorderDeps} deps - Injectable file and clock functions
   */
  constructor(ref: string, config: RecordingConfig, deps: RecorderDeps = {}) {
    this.ref = ref
    this.config = { ...DEFAULTS, ...config }
    this.appendFile =
      deps.appendFile ?? ((path, data) => fs.appendFile(path, data))
    this.now = deps.now ?? Date.now
    mkdirSync(this.config.path, { recursive: true })
    const timer = setInterval(() => this.sweep(), DEFAULTS.sweepIntervalMs)
    timer.unref()
    logger.info("message recording enabled", {
      path: this.config.path,
      mode: this.config.mode,
      redact: this.config.redact,
      lint: this.config.lint?.profiles?.join(",") ?? "off"
    })
  }

  /** Whether credentials are redacted before writing. */
  get redacts(): boolean {
    return this.config.redact
  }

  /**
   * Records a message after it crossed the dispatcher, when the call is
   * being recorded. Safe to call for every message.
   *
   * @param {object} params - What crossed the dispatcher
   * @param {MessageRequest} params.request - Message as received from the EdgePort
   * @param {MessageRequest} params.result - What the dispatcher returns, if any
   * @param {HopCollector} params.collector - Hops collected for this message
   * @param {string} params.flag - Ref of the resource that flagged the call, if any
   * @param {Error} params.error - The error returned to the EdgePort, if any
   */
  record(params: {
    request: MessageRequest
    result?: MessageRequest
    collector: HopCollector
    flag?: string
    error?: Error
  }): void {
    try {
      const session = this.sessionFor(params.request.ref, params.flag)
      if (!session) return
      if (session.seq >= this.config.maxRecordsPerCall) return

      session.seq += 1
      session.lastSeenAt = this.now()
      const record = this.lint(session, this.buildRecord(session, params))
      const line = JSON.stringify(record) + "\n"
      session.queue = session.queue
        .then(() => this.appendFile(session.file, line))
        .catch((e) => this.reportWriteError(e))
    } catch (e) {
      this.reportWriteError(e as Error)
    }
  }

  /**
   * Number of calls currently being recorded.
   *
   * @return {number} Active sessions
   */
  activeCalls(): number {
    return this.sessions.size
  }

  // eslint-disable-next-line require-jsdoc
  private sessionFor(callId: string, flag?: string): Session | undefined {
    const existing = this.sessions.get(callId)
    if (existing) {
      if (flag && !existing.trunkRef) existing.trunkRef = flag
      return existing
    }
    if (this.config.mode === RecordingMode.FLAGGED && !flag) return undefined
    if (this.sessions.size >= this.config.maxCalls) {
      this.dropped += 1
      if (this.dropped === 1 || this.dropped % 1000 === 0) {
        logger.warn("not recording call: too many calls being recorded", {
          maxCalls: this.config.maxCalls,
          dropped: this.dropped
        })
      }
      return undefined
    }
    const startedAt = this.now()
    const session: Session = {
      file: join(this.config.path, fileNameFor(startedAt, callId)),
      seq: 0,
      startedAt,
      lastSeenAt: startedAt,
      trunkRef: flag,
      queue: Promise.resolve(),
      recent: []
    }
    this.sessions.set(callId, session)
    return session
  }

  // eslint-disable-next-line require-jsdoc
  private buildRecord(
    session: Session,
    params: {
      request: MessageRequest
      result?: MessageRequest
      collector: HopCollector
      error?: Error
    }
  ): Trace.TraceRecord {
    const { request, result, collector, error } = params
    const isResponse = request.message.messageType === CT.MessageType.RESPONSE
    const resultIsResponse =
      result?.message?.messageType === CT.MessageType.RESPONSE
    const status = isResponse
      ? Trace.statusCodeOf(request.message.responseType)
      : resultIsResponse
      ? Trace.statusCodeOf(result.message.responseType)
      : undefined
    const outcome = error
      ? Trace.TraceOutcome.ERROR
      : isResponse
      ? Trace.TraceOutcome.RELAYED
      : resultIsResponse
      ? status !== undefined && status < 300
        ? Trace.TraceOutcome.ANSWERED
        : Trace.TraceOutcome.REJECTED
      : Trace.TraceOutcome.FORWARDED
    return {
      traceVersion: Trace.TRACE_VERSION,
      recordedAt: new Date(this.now()).toISOString(),
      callId: request.ref,
      seq: session.seq,
      tOffsetMs: Math.max(0, this.now() - session.startedAt),
      kind: isResponse ? Trace.TraceKind.RESPONSE : Trace.TraceKind.REQUEST,
      method: request.method,
      ...(status ? { status } : {}),
      edgePort: {
        ref: request.edgePortRef,
        ...(request.edgePortVersion ? { version: request.edgePortVersion } : {})
      },
      dispatcher: { ref: this.ref, version: DISPATCHER_VERSION },
      ...(session.trunkRef ? { trunkRef: session.trunkRef } : {}),
      request: this.config.redact
        ? Trace.redactRequest(stripTrace(request))
        : stripTrace(request),
      hops: collector.hops,
      response: result?.message
        ? {
            message: this.config.redact
              ? Trace.redactMessage(result.message)
              : result.message,
            ...(Object.keys(Trace.withoutTraceMetadata(result.metadata) ?? {})
              .length
              ? { metadata: Trace.withoutTraceMetadata(result.metadata) }
              : {})
          }
        : null,
      outcome,
      totalMs: collector.elapsedMs()
    }
  }

  /**
   * Evaluates the configured rule profiles on the record and keeps the
   * call's recent records for the rules that need them. Runs after the
   * answer went back to the EdgePort, so it costs the call nothing.
   *
   * @param {Session} session - The call being recorded
   * @param {Trace.TraceRecord} record - The record just built
   * @return {Trace.TraceRecord} The record, with findings when lint is on
   */
  private lint(session: Session, record: Trace.TraceRecord): Trace.TraceRecord {
    const lint = this.config.lint
    if (!lint?.profiles?.length) return record

    const window = lint.window ?? DEFAULT_LINT_WINDOW
    const findings = Trace.Rules.evaluate(record, session.recent, {
      profiles: lint.profiles
    })
    findings.forEach((f) =>
      logger.warn(`out of spec: ${f.message}`, {
        callId: record.callId,
        seq: record.seq,
        rule: f.rule,
        severity: f.severity,
        spec: f.spec
      })
    )
    const linted = {
      ...record,
      lint: { version: Trace.Rules.RULESET_VERSION, profiles: lint.profiles },
      findings
    }
    if (window > 0) {
      session.recent.push(linted)
      if (session.recent.length > window) session.recent.shift()
    }
    return linted
  }

  // eslint-disable-next-line require-jsdoc
  private sweep(): void {
    const cutoff = this.now() - this.config.idleTimeoutSeconds * 1000
    Array.from(this.sessions.entries())
      .filter(([, s]) => s.lastSeenAt < cutoff)
      .forEach(([callId]) => this.sessions.delete(callId))
  }

  // eslint-disable-next-line require-jsdoc
  private reportWriteError(e: Error): void {
    logger.error("failed to write trace record", { error: e?.message })
  }
}

// The request as the record carries it: no trace.* metadata, and no
// receivedOn when the EdgePort could not name the interface (proto-loader
// hands an unset message field over as null)
const stripTrace = (request: MessageRequest): MessageRequest => {
  const { receivedOn, metadata, ...rest } = request
  return {
    ...rest,
    ...(receivedOn?.host ? { receivedOn } : {}),
    ...(metadata ? { metadata: Trace.withoutTraceMetadata(metadata) } : {})
  }
}

/**
 * Builds a file name that sorts by time and is safe on every file system.
 *
 * @param {number} startedAt - Epoch millis of the first recorded message
 * @param {string} callId - The Call-ID
 * @return {string} e.g. 20261023T024110321Z-1-25_10.111.221.22.jsonl
 */
export function fileNameFor(startedAt: number, callId: string): string {
  const stamp = new Date(startedAt).toISOString().replace(/[-:]/g, "")
  const safe = callId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120)
  return `${stamp.replace(".", "")}-${safe}.jsonl`
}
