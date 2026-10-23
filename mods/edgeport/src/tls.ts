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
// Used when neither the environment nor the config sets the protocols.
// Older versions must be listed explicitly.
export const DEFAULT_TLS_PROTOCOLS = ["TLSv1.3"]

// Used when neither the environment nor the config sets the cipher suites.
// Without a list, JAIN-SIP falls back to its own defaults, which include RSA
// key exchange, CBC, 3DES, and anonymous DH. The TLS 1.2 suites only take
// effect when TLSv1.2 is also enabled.
export const DEFAULT_TLS_CIPHER_SUITES = [
  // TLS 1.3
  "TLS_AES_256_GCM_SHA384",
  "TLS_AES_128_GCM_SHA256",
  "TLS_CHACHA20_POLY1305_SHA256",
  // TLS 1.2
  "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
  "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
  "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
  "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
  "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
  "TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256"
]

// The environment wins over the config, and the config over the default
export const resolveTlsSetting = (
  fromEnv: string[],
  fromConfig: string[] | undefined,
  fallback: string[]
): string[] => {
  if (fromEnv.length > 0) return fromEnv
  if (fromConfig && fromConfig.length > 0) return fromConfig
  return fallback
}
