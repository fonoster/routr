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

export interface KeyStoreSettings {
  keyStore?: string
  keyStorePassword?: string
  keyStoreType?: string
  trustStore?: string
  trustStorePassword?: string
}

// The javax.net.ssl properties for the keystore and the truststore. Only the
// values that are set are returned: JAIN-SIP reads a missing property as "use
// the JVM default", and the JVM default truststore (cacerts) is what trusts the
// public certificates carriers present when the EdgePort calls them over TLS.
// Pointing the truststore at the EdgePort's own keystore, as older examples did,
// trusts only that one certificate and fails the handshake to a carrier.
export const getKeyStoreProperties = (
  settings: KeyStoreSettings | undefined
): Record<string, string> => {
  const mapping: Array<[string, string | undefined]> = [
    ["javax.net.ssl.keyStore", settings?.keyStore],
    ["javax.net.ssl.keyStorePassword", settings?.keyStorePassword],
    ["javax.net.ssl.keyStoreType", settings?.keyStoreType],
    ["javax.net.ssl.trustStore", settings?.trustStore],
    ["javax.net.ssl.trustStorePassword", settings?.trustStorePassword]
  ]
  // No Object.fromEntries: the EdgePort runs this on GraalJS 22.3
  return mapping
    .filter(([, value]) => value !== undefined && value !== "")
    .reduce((props, [key, value]) => ({ ...props, [key]: value }), {})
}

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

// Trims entries and drops blank ones. JAIN-SIP's WSS channel splits the
// protocols on "," alone and rejects names with spaces, and an empty
// variable must not override the config or the defaults.
const clean = (list: string[] | undefined): string[] =>
  (list ?? []).map((item) => item.trim()).filter((item) => item.length > 0)

// The environment wins over the config, and the config over the default
export const resolveTlsSetting = (
  fromEnv: string[] | undefined,
  fromConfig: string[] | undefined,
  fallback: string[]
): string[] => {
  const env = clean(fromEnv)
  if (env.length > 0) return env
  const config = clean(fromConfig)
  if (config.length > 0) return config
  return fallback
}

// JAIN-SIP properties that select the TLS versions and cipher suites. They
// apply to the TLS and WSS transports, for both incoming and outgoing
// connections.
export const getTlsProperties = (
  client: { protocols?: string[]; cipherSuites?: string[] } | undefined,
  env: { protocols?: string[]; cipherSuites?: string[] }
): Record<string, string> => ({
  "gov.nist.javax.sip.TLS_CLIENT_PROTOCOLS": resolveTlsSetting(
    env.protocols,
    client?.protocols,
    DEFAULT_TLS_PROTOCOLS
  ).join(),
  "gov.nist.javax.sip.ENABLED_CIPHER_SUITES": resolveTlsSetting(
    env.cipherSuites,
    client?.cipherSuites,
    DEFAULT_TLS_CIPHER_SUITES
  ).join()
})
