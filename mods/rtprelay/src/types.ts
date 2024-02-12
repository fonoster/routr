import { MessageRequest } from "@routr/common"

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
export enum Direction {
  WEB_TO_WEB = "web-to-web",
  WEB_TO_PHONE = "web-to-phone",
  PHONE_TO_WEB = "phone-to-web",
  PHONE_TO_PHONE = "phone-to-phone"
}

export interface RTPERequest {
  "call-id": string
  "from-tag": string
  "to-tag"?: string
  "DTLS-fingerprint"?: string
  "DTLS-passive"?: boolean
  "transport-protocol"?: string
  sdp?: string
  ICE?: string
  SDES?: string
}

export interface RTPEConfig {
  host: string
  port: number
}

export type RTPEClient = {
  send: (request: RTPERequest) => Promise<string>
}

export type RTPEFunctionResult =
  | {
      result: "ok"
      sdp: string
    }
  | { result: "error"; "error-reason": string }

export type RTPEFunction = (
  config: RTPEConfig
) => (req: MessageRequest) => Promise<RTPEFunctionResult>
