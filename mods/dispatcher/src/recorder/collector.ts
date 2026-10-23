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
import { performance } from "perf_hooks"
import { CommonTypes as CT, MessageRequest, Trace } from "@routr/common"

/**
 * Collects what happened to one message while it crossed the dispatcher:
 * which components touched it, how long each took and what each changed.
 * One collector per inbound message; cheap enough to create even when
 * recording is off (it only pushes to an array).
 */
export class HopCollector {
  readonly hops: Trace.TraceHop[] = []
  readonly startedAt = performance.now()

  /**
   * Records a hop whose outcome is already known.
   *
   * @param {Trace.TraceHop} hop - The hop
   */
  add(hop: Trace.TraceHop): void {
    this.hops.push(hop)
  }

  /**
   * Records a component call from the message it received and the message
   * it returned, computing the diff and the action.
   *
   * @param {object} params - Hop parameters
   * @param {string} params.component - Component ref
   * @param {Trace.HopKind} params.kind - Component kind
   * @param {string} params.version - Component version, if announced
   * @param {number} params.startedAt - performance.now() before the call
   * @param {CT.SIPMessage} params.before - Message sent to the component
   * @param {CT.SIPMessage} params.after - Message the component returned
   */
  addCall(params: {
    component: string
    kind: Trace.HopKind
    version?: string
    startedAt: number
    before: CT.SIPMessage
    after?: CT.SIPMessage
  }): void {
    const { component, kind, version, startedAt, before, after } = params
    const durationMs = round(performance.now() - startedAt)
    const diff = after ? Trace.diffMessages(before, after) : undefined
    const action = !after
      ? Trace.HopAction.ERROR
      : after.messageType === CT.MessageType.RESPONSE
      ? before.messageType === CT.MessageType.RESPONSE
        ? Trace.HopAction.RELAYED
        : Trace.HopAction.RESPONDED
      : diff && Trace.isEmptyDiff(diff)
      ? Trace.HopAction.PASS_THROUGH
      : Trace.HopAction.FORWARDED

    this.hops.push({
      component,
      kind,
      ...(version ? { version } : {}),
      durationMs,
      action,
      ...(diff ? { diff } : {})
    })
  }

  /**
   * Records a failed component call.
   *
   * @param {object} params - Hop parameters
   * @param {string} params.component - Component ref
   * @param {Trace.HopKind} params.kind - Component kind
   * @param {number} params.startedAt - performance.now() before the call
   * @param {string} params.error - What went wrong
   */
  addError(params: {
    component: string
    kind: Trace.HopKind
    startedAt: number
    error: string
  }): void {
    this.hops.push({
      component: params.component,
      kind: params.kind,
      durationMs: round(performance.now() - params.startedAt),
      action: Trace.HopAction.ERROR,
      error: params.error
    })
  }

  /**
   * Total time since the collector was created, in milliseconds.
   *
   * @return {number} Elapsed time
   */
  elapsedMs(): number {
    return round(performance.now() - this.startedAt)
  }
}

const round = (ms: number) => Math.round(ms * 10) / 10

/**
 * Returns the version a component announced in its gRPC initial metadata.
 *
 * @param {object} call - The client call returned by grpc-js
 * @return {Promise<string | undefined>} Resolves when metadata arrives or the call ends
 */
export function versionFromCall(call: unknown): Promise<string | undefined> {
  return new Promise((resolve) => {
    const emitter = call as
      | { on?: (event: string, cb: (arg: unknown) => void) => void }
      | undefined
    if (!emitter?.on) return resolve(undefined)
    emitter.on("metadata", (md) => {
      const values = (md as { get: (k: string) => unknown[] }).get(
        VERSION_METADATA_KEY
      )
      resolve(values?.length ? String(values[0]) : undefined)
    })
    emitter.on("status", () => resolve(undefined))
  })
}

/** gRPC metadata key under which @routr/processor announces its version. */
export const VERSION_METADATA_KEY = "routr-component-version"

/**
 * Marks a request so the next hop treats the message as part of a recorded
 * call. Set by the connect processor on the trunk's behalf.
 *
 * @param {MessageRequest} request - A request as returned by a processor
 * @return {string | undefined} The trunk ref that asked for the recording
 */
export function traceFlagOf(request: MessageRequest): string | undefined {
  return request.metadata?.[Trace.TRACE_FLAG_METADATA_KEY]
}
