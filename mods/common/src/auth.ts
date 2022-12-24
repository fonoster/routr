/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import {
  AuthChallengeRequest,
  AuthChallengeResponse,
  ResponseType
} from "./types"
import crypto from "crypto"

const DEFAULT_ALGORITHM = "MD5"

const md5hex = (str: string, algorithm = DEFAULT_ALGORITHM) =>
  crypto.createHash(algorithm).update(str).digest("hex")

const decToHex = (dec: number) =>
  (dec + Math.pow(16, 8)).toString(16).substr(-8)

export const generateNonce = (algorithm: string = DEFAULT_ALGORITHM) =>
  md5hex(`${new Date().getTime()}${Math.random()}`, algorithm)

export const buildAuthChallenge = (request: AuthChallengeRequest) => {
  const { realm, scheme, algorithm, qop, opaque, stale } = request
  return {
    realm,
    scheme,
    algorithm,
    qop,
    opaque,
    stale,
    nonce: generateNonce(algorithm)
  }
}

export const calculateAuthResponse = (
  res: AuthChallengeResponse,
  credentials: { username: string; secret: string }
) => {
  if (!credentials) return null

  const a1 = `${credentials.username}:${res.realm}:${credentials.secret}`
  const a2 = `${res.method.toUpperCase()}:${res.uri}`
  const ha1 = md5hex(a1)
  const ha2 = md5hex(a2)

  return res.qop === "auth"
    ? md5hex(
        `${ha1}:${res.nonce}:${decToHex(res.nonceCount)}:${res.cNonce}:${
          res.qop
        }:${ha2}`
      )
    : md5hex(`${ha1}:${res.nonce}:${ha2}`)
}

export const getCredentials = (
  username: string,
  users: { username: string; secret: string }[]
) => users.find((user) => user.username === username)

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

export const createUnauthorizedResponseWithoutChallenge = () => {
  return {
    message: {
      responseType: ResponseType.UNAUTHORIZED
    }
  }
}

export const createServerInternalErrorResponse = () => {
  return {
    message: {
      responseType: ResponseType.SERVER_INTERNAL_ERROR
    }
  }
}

export const createForbideenResponse = () => {
  return {
    message: {
      responseType: ResponseType.FORBIDDEN
    }
  }
}
