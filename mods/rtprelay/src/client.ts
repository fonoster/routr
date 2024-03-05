/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
/* eslint-disable require-jsdoc */
import { MessageRequest } from "@routr/common"
import { RTPENGINE_TIMEOUT } from "./envs"
import { RTPEConfig, RTPEFunctionResult } from "./types"
import {
  getDirectionFromRequest,
  getDirectionFromResponse,
  getRTPEParamsByDirection
} from "./utils"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Client = require("rtpengine-client").Client
const rtpe = new Client({ timeout: RTPENGINE_TIMEOUT })

export function query(config: RTPEConfig) {
  return async (request: MessageRequest): Promise<RTPEFunctionResult> => {
    return await rtpe.query(config, {
      "call-id": request.message.callId.callId
    })
  }
}

export function offer(config: RTPEConfig, invertTags = false) {
  return async (request: MessageRequest): Promise<RTPEFunctionResult> => {
    const direction = getDirectionFromRequest(request)
    const sdpModifiers = getRTPEParamsByDirection(direction)
    return await rtpe.offer(config, {
      ...sdpModifiers,
      sdp: request.message.body,
      "call-id": request.message.callId.callId,
      "from-tag": invertTags ? request.message.to.tag : request.message.from.tag
    })
  }
}

export function answer(config: RTPEConfig, invertTags = false) {
  return async (request: MessageRequest): Promise<RTPEFunctionResult> => {
    const direction = getDirectionFromResponse(request)
    const sdpModifiers = getRTPEParamsByDirection(direction)
    return await rtpe.answer(config, {
      ...sdpModifiers,
      sdp: request.message.body,
      "call-id": request.message.callId.callId,
      "from-tag": invertTags
        ? request.message.to.tag
        : request.message.from.tag,
      "to-tag": invertTags ? request.message.from.tag : request.message.to.tag
    })
  }
}

export function del(config: RTPEConfig) {
  return async (request: MessageRequest): Promise<RTPEFunctionResult> =>
    await rtpe.delete(config, {
      "call-id": request.message.callId.callId,
      "from-tag": request.message.from.tag
    })
}
