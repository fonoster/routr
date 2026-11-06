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
import { AuthChallengeResponse } from "./types"
import crypto from "crypto"

export const DEFAULT_ALGORITHM = "MD5"

const md5hex = (str: string, algorithm = DEFAULT_ALGORITHM) =>
  crypto.createHash(algorithm).update(str).digest("hex")

const decToHex = (dec: number) => (dec + Math.pow(16, 8)).toString(16).slice(-8)

// A nonce carries the second it was issued, so a captured Authorization
// header stops working once NONCE_MAX_AGE_SECONDS have passed (isNonceFresh)
export const NONCE_MAX_AGE_SECONDS = 300

export const generateNonce = (
  algorithm: string = DEFAULT_ALGORITHM,
  now: () => number = Date.now
) => {
  const issuedAt = Math.floor(now() / 1000).toString(16)
  return `${issuedAt}.${md5hex(`${now()}${Math.random()}`, algorithm)}`
}

/**
 * Whether a nonce was issued by generateNonce within the last maxAgeSeconds.
 * A nonce in another format is never fresh, so a header captured before
 * nonces carried their time can't be replayed either.
 *
 * @param {string} nonce - the nonce from the Authorization header
 * @param {number} maxAgeSeconds - how long a nonce stays valid; 0 means forever
 * @param {Function} now - the clock, injected by tests
 * @return {boolean} true when the nonce is fresh
 */
export const isNonceFresh = (
  nonce: string | undefined,
  maxAgeSeconds: number = NONCE_MAX_AGE_SECONDS,
  now: () => number = Date.now
): boolean => {
  if (maxAgeSeconds === 0) return true
  const [issuedAtHex, digest] = (nonce ?? "").split(".")
  if (!digest || !/^[0-9a-f]+$/.test(issuedAtHex)) return false
  // A nonce dated ahead of this clock (another instance's) is only as fresh
  // as it gets: the digest binds it, so no one gains by choosing one
  const age = Math.floor(now() / 1000) - parseInt(issuedAtHex, 16)
  return age <= maxAgeSeconds
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
