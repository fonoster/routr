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
declare const System: { getenv: (key: string) => string | undefined }

export const EXTERNAL_ADDRS = System.getenv("EXTERNAL_ADDRS")?.split(",") ?? []
export const LOCALNETS = System.getenv("LOCALNETS")?.split(",") ?? []
export const SECURITY_CONTEXT_CLIENT_PROTOCOLS =
  System.getenv("SECURITY_CONTEXT_CLIENT_PROTOCOLS")?.split(",") ?? []
export const SECURITY_CONTEXT_CLIENT_CIPHER_SUITES =
  System.getenv("SECURITY_CONTEXT_CLIENT_CIPHER_SUITES")?.split(",") ?? []
// JAIN-SIP's own trace level (gov.nist.javax.sip.TRACE_LEVEL), for example 32 for
// debug. Unset keeps the stack quiet. Its output goes to the "routr" logger.
export const JAIN_SIP_TRACE_LEVEL = System.getenv("JAIN_SIP_TRACE_LEVEL")
