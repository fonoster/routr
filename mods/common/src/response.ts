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
import { DEFAULT_ALGORITHM, generateNonce } from "./auth"
import { ResponseType } from "./types"

export const createUnauthorizedResponse = (
  realm: string,
  params: {
    qop: string
    algorithm: string
  } = { qop: "auth", algorithm: DEFAULT_ALGORITHM }
) => {
  return {
    message: {
      responseType: ResponseType.UNAUTHORIZED,
      reasonPhrase: "Unauthorized",
      wwwAuthenticate: {
        scheme: "Digest",
        realm: realm,
        qop: params.qop,
        opaque: "",
        stale: false,
        nonce: generateNonce(),
        algorithm: params.algorithm
      }
    }
  }
}

export const createUnauthorizedResponseWithoutChallenge = (
  metadata?: Record<string, string>
) => {
  return {
    metadata,
    message: {
      responseType: ResponseType.UNAUTHORIZED,
      reasonPhrase: "Unauthorized"
    }
  }
}

export const createServerInternalErrorResponse = (
  metadata?: Record<string, string>
) => {
  return {
    metadata,
    message: {
      responseType: ResponseType.SERVER_INTERNAL_ERROR,
      reasonPhrase: "Server Internal Error"
    }
  }
}

export const createForbiddenResponse = (metadata?: Record<string, string>) => {
  return {
    metadata,
    message: {
      responseType: ResponseType.FORBIDDEN,
      reasonPhrase: "Forbidden"
    }
  }
}
