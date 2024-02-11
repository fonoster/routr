/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
import { Method, CommonTypes as CT } from "@routr/common"
import {
  DEFAULT_EXPIRES,
  DEFAULT_MAX_FORWARDS,
  RegistrationRequest,
  RequestParams
} from "./types"
import uniqid from "uniqid"

// Global count for Registry CSEQ
let cseq = 1

/**
 * Creates a new Registration request.
 *
 * @param {RequestParams} params - The parameters to build the request
 * @return {RegistrationRequest}
 */
export default function createRegistrationRequest(
  params: RequestParams
): RegistrationRequest {
  const credentials = params.auth
    ? {
        name: CT.ExtraHeader.GATEWAY_AUTH,
        value: Buffer.from(
          `${params.auth.username}:${params.auth.secret}`
        ).toString("base64")
      }
    : undefined

  return {
    target: params.targetAddress,
    method: Method.REGISTER,
    transport: params.transport,
    trunkRef: params.trunkRef,
    user: params.user,
    message: {
      extensions: [
        ...(params.methods?.map((value: string) => {
          return { name: "Allow", value }
        }) ?? []),
        {
          name: "CSeq",
          value: `${cseq++} ${Method.REGISTER}`
        },
        {
          name: "User-Agent",
          // TODO: Take from central location (commons?)
          value: params.userAgent ?? "Routr Connect v2"
        },
        // TODO: Q. Should this be in the registry configuration?
        {
          name: "Allow-Events",
          value: "presence"
        },
        {
          name: "Proxy-Require",
          value: "gin"
        },
        {
          name: "Require",
          value: "gin"
        },
        {
          name: "Supported",
          value: "path"
        },
        credentials
      ],
      route: [
        {
          address: {
            uri: {
              host: getHostFromAddress(params.proxyAddress),
              port: getPortFromAddress(params.proxyAddress),
              transportParam: params.transport,
              lrParam: true
            }
          }
        }
      ],
      from: {
        address: {
          uri: {
            user: params.user,
            host: params.targetDomain,
            port: -1,
            transportParam: params.transport,
            secure: params.secure
          }
        },
        tag: uniqid.time()
      },
      to: {
        address: {
          uri: {
            user: params.user,
            host: params.targetDomain,
            port: -1,
            transportParam: params.transport,
            secure: params.secure
          }
        }
      },
      callId: {
        callId: uniqid()
      },
      contentLength: {
        contentLength: 0
      },
      expires: {
        expires: params.expires ?? DEFAULT_EXPIRES
      },
      maxForwards: {
        maxForwards: params.maxForwards ?? DEFAULT_MAX_FORWARDS
      },
      requestUri: {
        user: params.user,
        host: getHostFromAddress(params.targetAddress),
        port: getPortFromAddress(params.targetAddress),
        transportParam: params.transport,
        methodParam: Method.REGISTER,
        secure: params.secure
      },
      via: [],
      recordRoute: [],
      messageType: CT.MessageType.REQUEST
    }
  }
}

export const getHostFromAddress = (address: string): string => {
  if (address.split(":").length != 2) {
    throw new Error("malformated address; must be ${host}:${port}")
  }
  return address.split(":")[0]
}

export const getPortFromAddress = (address: string): number => {
  if (address.split(":").length != 2) {
    throw new Error("malformated address; must be ${host}:${port}")
  }
  try {
    return parseInt(address.split(":")[1])
  } catch (e) {
    throw new Error("expects port to be a number")
  }
}
