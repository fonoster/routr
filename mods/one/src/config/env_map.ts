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

export interface EnvMapping {
  // Key path under spec
  key: string
  envVar: string
  // The image's ENV value (or the code default); an env var equal to it counts as unset
  imageDefault?: string
  // A boolean key whose env var means the opposite (enabled vs. disabled)
  inverted?: boolean
}

/**
 * The env var each spec key replaces. The recording keys redact, lint,
 * maxRecordsPerCall, maxCalls and idleTimeoutSeconds have none: the file is
 * the only way to set them.
 */
export const ENV_MAP: EnvMapping[] = [
  {
    key: "database.url",
    envVar: "DATABASE_URL",
    imageDefault: "postgres://postgres:postgres@localhost:5432/routr"
  },
  {
    key: "database.startInternal",
    envVar: "START_INTERNAL_DB",
    imageDefault: "true"
  },
  { key: "encryption.key", envVar: "CLOAK_ENCRYPTION_KEY" },
  { key: "apiServer.tls.enabled", envVar: "TLS_ON", imageDefault: "false" },
  {
    key: "apiServer.tls.verifyClientCert",
    envVar: "VERIFY_CLIENT_CERT",
    imageDefault: "false"
  },
  {
    key: "apiServer.tls.caCert",
    envVar: "CACERT",
    imageDefault: "/etc/routr/certs/ca.crt"
  },
  {
    key: "apiServer.tls.serverCert",
    envVar: "SERVER_CERT",
    imageDefault: "/etc/routr/certs/server.crt"
  },
  {
    key: "apiServer.tls.serverKey",
    envVar: "SERVER_KEY",
    imageDefault: "/etc/routr/certs/server.key"
  },
  { key: "signaling.externalAddrs", envVar: "EXTERNAL_ADDRS" },
  { key: "signaling.localnets", envVar: "LOCALNETS" },
  { key: "signaling.aliases", envVar: "ALIASES" },
  {
    key: "signaling.ignoreLoopbackFromLocalnets",
    envVar: "IGNORE_LOOPBACK_FROM_LOCALNETS",
    imageDefault: "true"
  },
  {
    key: "signaling.keyStorePassword",
    envVar: "PKCS12_PASSWORD",
    imageDefault: "changeme"
  },
  {
    key: "signaling.certsPath",
    envVar: "PATH_TO_CERTS",
    imageDefault: "/etc/routr/certs"
  },
  {
    key: "signaling.tls.protocols",
    envVar: "SECURITY_CONTEXT_CLIENT_PROTOCOLS"
  },
  {
    key: "signaling.tls.cipherSuites",
    envVar: "SECURITY_CONTEXT_CLIENT_CIPHER_SUITES"
  },
  {
    key: "signaling.stripSessionProgressSdp",
    envVar: "STRIP_SESSION_PROGRESS_SDP"
  },
  { key: "signaling.healthChecks", envVar: "ENABLE_HEALTHCHECKS" },
  { key: "signaling.sipTraceLevel", envVar: "JAIN_SIP_TRACE_LEVEL" },
  {
    key: "signaling.log4j2",
    envVar: "LOG4J2",
    imageDefault: "/etc/routr/log4j2.yaml"
  },
  {
    key: "signaling.publishers.console.enabled",
    envVar: "CONSOLE_PUBLISHER_ENABLED"
  },
  {
    key: "signaling.publishers.nats.enabled",
    envVar: "NATS_PUBLISHER_ENABLED"
  },
  { key: "signaling.publishers.nats.url", envVar: "NATS_PUBLISHER_URL" },
  {
    key: "signaling.publishers.nats.subject",
    envVar: "NATS_PUBLISHER_SUBJECT"
  },
  { key: "connect.verifier.addr", envVar: "CONNECT_VERIFIER_ADDR" },
  {
    key: "connect.verifier.publicKeyPath",
    envVar: "CONNECT_VERIFIER_PUBLIC_KEY_PATH"
  },
  { key: "connect.verifier.options", envVar: "CONNECT_VERIFIER_OPTIONS" },
  {
    key: "connect.registerDefaultExpires",
    envVar: "REGISTER_DEFAULT_EXPIRES"
  },
  {
    key: "connect.untrustedHeadersToStrip",
    envVar: "UNTRUSTED_HEADERS_TO_STRIP"
  },
  { key: "connect.trustedEdgeports", envVar: "TRUSTED_EDGEPORTS" },
  {
    key: "connect.trustedEdgeportAddresses",
    envVar: "TRUSTED_EDGEPORT_ADDRESSES"
  },
  {
    key: "location.cache.provider",
    envVar: "LOCATION_CACHE_PROVIDER",
    imageDefault: "memory"
  },
  { key: "location.cache.parameters", envVar: "LOCATION_CACHE_PARAMETERS" },
  { key: "rtprelay.host", envVar: "RTPENGINE_HOST" },
  { key: "rtprelay.port", envVar: "RTPENGINE_PORT", imageDefault: "22222" },
  {
    key: "rtprelay.timeout",
    envVar: "RTPENGINE_TIMEOUT",
    imageDefault: "5000"
  },
  {
    key: "rtprelay.configPath",
    envVar: "RTPRELAY_CONFIG_PATH",
    imageDefault: "/etc/routr/rtprelay.yaml"
  },
  { key: "recording.enabled", envVar: "RECORD_MESSAGES" },
  { key: "recording.mode", envVar: "RECORD_MESSAGES_MODE" },
  { key: "recording.path", envVar: "RECORD_MESSAGES_PATH" },
  { key: "telemetry.endpoint", envVar: "OTEL_EXPORTER_OTLP_ENDPOINT" },
  {
    key: "telemetry.tracesEndpoint",
    envVar: "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"
  },
  {
    key: "telemetry.metricExportIntervalMillis",
    envVar: "OTEL_METRIC_EXPORT_INTERVAL"
  },
  { key: "telemetry.enabled", envVar: "OTEL_SDK_DISABLED", inverted: true },
  { key: "telemetry.serviceName", envVar: "OTEL_SERVICE_NAME" },
  { key: "logs.level", envVar: "LOGS_LEVEL" },
  { key: "logs.format", envVar: "LOGS_FORMAT" },
  { key: "logs.transport", envVar: "LOGS_TRANSPORT" },
  { key: "logs.fluent.host", envVar: "LOGS_DRIVER_HOST" },
  { key: "logs.fluent.port", envVar: "LOGS_DRIVER_PORT" },
  { key: "logs.fluent.tagPrefix", envVar: "LOGS_OPT_TAG_PREFIX" },
  { key: "heplify.options", envVar: "HEPLIFY_OPTIONS" }
]

// Keys whose file value may not hold a GENERATE-YOUR-OWN placeholder
export const SECRET_KEYS = [
  "database.url",
  "encryption.key",
  "signaling.keyStorePassword"
]
