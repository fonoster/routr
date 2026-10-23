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
import { Args, Command, Flags } from "@oclif/core"
import * as grpc from "@grpc/grpc-js"
import {
  CommonTypes as CT,
  MessageRequest,
  PROCESSOR_OBJECT_PROTO,
  Trace
} from "@routr/common"
import { pickGlyphs } from "../../trace/glyphs"
import { loadTrace, TraceLoadError } from "../../trace/load"
import { labelOf } from "../../trace/model"

/**
 * Sends a recorded message to a dispatcher or processor over gRPC.
 *
 * @param {string} addr - host:port of the Processor service
 * @param {MessageRequest} request - The recorded request
 * @return {Promise<MessageRequest>} What the service returned
 */
export function sendToProcessor(
  addr: string,
  request: MessageRequest
): Promise<MessageRequest> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new (PROCESSOR_OBJECT_PROTO as any).Processor(
    addr,
    grpc.credentials.createInsecure()
  )
  return new Promise((resolve, reject) => {
    client.processMessage(
      request,
      (err: Error | null, result: MessageRequest) =>
        err ? reject(err) : resolve(result)
    )
  })
}

// eslint-disable-next-line require-jsdoc
export default class SendCommand extends Command {
  static readonly description =
    "Sends one recorded message to a running dispatcher or processor and shows how the live answer differs from the recorded one. Useful to reproduce a routing decision against a fix without placing a call."

  static readonly examples = [
    "<%= config.bin %> <%= command.id %> call.jsonl --to localhost:51901",
    "<%= config.bin %> <%= command.id %> call.jsonl --seq 7 --to connect:51904"
  ]

  static readonly flags = {
    to: Flags.string({
      char: "t",
      description:
        "host:port of the Processor gRPC service (a dispatcher or a processor)",
      required: true
    }),
    seq: Flags.integer({
      description:
        "record to send (default: the first forwarded INVITE, else the first record)"
    }),
    json: Flags.boolean({
      description: "print the live answer as JSON instead of a diff",
      default: false
    })
  }

  static args = {
    file: Args.string({
      required: true,
      description: "a .jsonl trace written by the dispatcher"
    })
  }

  // eslint-disable-next-line require-jsdoc
  async run(): Promise<void> {
    const { args, flags } = await this.parse(SendCommand)
    const g = pickGlyphs()
    let records: Trace.TraceRecord[]
    try {
      records = loadTrace(args.file).records
    } catch (e) {
      if (e instanceof TraceLoadError) this.error(e.message, { exit: e.exit })
      throw e
    }
    const record =
      flags.seq !== undefined
        ? records.find((r) => r.seq === flags.seq)
        : records.find(
            (r) =>
              r.method === "INVITE" &&
              r.outcome === Trace.TraceOutcome.FORWARDED
          ) ?? records[0]
    if (!record) this.error(`no record with seq ${flags.seq}`, { exit: 1 })

    // Credentials were redacted at recording time; the live answer to a
    // redacted Authorization is a challenge, which is itself informative.
    const request: MessageRequest = { ...record.request }
    this.log(
      `sending record ${record.seq} ${g.sep} ${labelOf(record)} ${g.sep} to ${
        flags.to
      }`
    )

    let live: MessageRequest
    try {
      live = await sendToProcessor(flags.to, request)
    } catch (e) {
      this.error(`${flags.to}: ${(e as Error).message}`, { exit: 2 })
    }

    if (flags.json) {
      this.log(JSON.stringify(live, null, 2))
      return
    }

    const liveIsResponse = live.message?.messageType === CT.MessageType.RESPONSE
    const liveStatus = liveIsResponse
      ? Trace.statusCodeOf(live.message.responseType)
      : undefined
    const liveOutcome = liveIsResponse
      ? `rejected ${liveStatus ?? ""} ${Trace.reasonPhraseOf(
          live.message.responseType
        )}`
      : `forwarded to ${Trace.formatUri(live.message?.requestUri)}`
    const recordedOutcome =
      record.outcome + (record.status ? ` ${record.status}` : "")
    this.log(`recorded  ${recordedOutcome}`)
    this.log(`live      ${liveOutcome}`)

    if (!record.response || !live.message) {
      this.log("no recorded outgoing message to compare against")
      return
    }
    const diff = Trace.diffMessages(
      record.response.message,
      Trace.redactMessage(live.message)
    )
    if (Trace.isEmptyDiff(diff)) {
      this.log(`${g.pass} live answer matches the recording`)
      return
    }
    this.log(
      `${
        g.differs
      } live answer differs from the recording (recorded ${"→"} live)`
    )
    if (diff.requestUri)
      this.log(
        `${g.changed} Request-URI  ${diff.requestUri.from} ${"→"} ${
          diff.requestUri.to
        }`
      )
    Object.entries(diff.headers.changed).forEach(([k, v]) =>
      this.log(`${g.changed} ${k}  ${v.from} ${"→"} ${v.to}`)
    )
    Object.entries(diff.headers.added).forEach(([k, v]) =>
      this.log(`${g.added} ${k}  ${v}`)
    )
    Object.entries(diff.headers.removed).forEach(([k, v]) =>
      this.log(`${g.removed} ${k}  ${v}`)
    )
  }
}
