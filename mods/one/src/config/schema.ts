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
import { recordingSchema } from "@routr/dispatcher"

const str = { type: "string", minLength: 1 }
const bool = { type: "boolean" }
const port = { type: "integer", minimum: 1, maximum: 65535 }
const positive = { type: "integer", minimum: 1 }
const list = { type: "array", items: str }
const nonEmptyList = { ...list, minItems: 1 }

const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  additionalProperties: false
})

export const schema = {
  title: "Routr One configuration",
  description: "Configuration for a routr-one container",
  type: "object",
  properties: {
    kind: { description: "Resource type", const: "RoutrOne" },
    apiVersion: { description: "Resource version", const: "v2beta1" },
    ref: { description: "Instance reference", ...str },
    spec: obj({
      database: obj({ url: str, startInternal: bool }),
      encryption: obj({ key: str }),
      apiServer: obj({
        tls: obj({
          enabled: bool,
          verifyClientCert: bool,
          caCert: str,
          serverCert: str,
          serverKey: str
        })
      }),
      signaling: obj({
        externalAddrs: nonEmptyList,
        localnets: nonEmptyList,
        aliases: { ...list, uniqueItems: true },
        ignoreLoopbackFromLocalnets: bool,
        keyStorePassword: str,
        certsPath: str,
        tls: obj({ protocols: list, cipherSuites: list }),
        stripSessionProgressSdp: bool,
        healthChecks: bool,
        sipTraceLevel: { type: ["string", "integer"], minLength: 1 },
        log4j2: str,
        publishers: obj({
          console: obj({ enabled: bool }),
          nats: obj({ enabled: bool, url: str, subject: str })
        })
      }),
      connect: obj({
        verifier: obj({
          addr: str,
          publicKeyPath: str,
          options: { type: "object" }
        }),
        registerDefaultExpires: positive,
        untrustedHeadersToStrip: list,
        trustedEdgeports: list,
        trustedEdgeportAddresses: list
      }),
      location: obj({
        cache: obj({
          provider: { type: "string", enum: ["memory", "redis"] },
          parameters: str
        })
      }),
      rtprelay: obj({
        host: str,
        port,
        timeout: positive,
        configPath: str
      }),
      recording: recordingSchema,
      telemetry: obj({
        enabled: bool,
        endpoint: str,
        tracesEndpoint: str,
        metricExportIntervalMillis: positive,
        serviceName: str
      }),
      logs: obj({
        level: {
          type: "string",
          enum: ["error", "warn", "info", "http", "verbose", "debug", "silly"]
        },
        format: { type: "string", enum: ["json", "text"] },
        transport: { type: "string", enum: ["console", "fluent"] },
        fluent: obj({ host: str, port, tagPrefix: str })
      }),
      heplify: obj({ options: str })
    })
  },
  required: ["kind", "apiVersion", "ref", "spec"],
  additionalProperties: false
}
