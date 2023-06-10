/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
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
import { Assertions as A } from "@routr/common"

A.assertEnvsAreSet(["DATABASE_URL"])

export const TLS_ON = process.env.TLS_ON === "true"
export const VERIFY_CLIENT_CERT = process.env.VERIFY_CLIENT_CERT === "true"
export const CACERT = process.env.CACERT ?? "/etc/routr/certs/ca.crt"
export const SERVER_CERT =
  process.env.SERVER_CERT ?? "/etc/routr/certs/server.crt"
export const SERVER_KEY =
  process.env.SERVER_KEY ?? "/etc/routr/certs/server.key"
export const BIND_ADDR = process.env.BIND_ADDR ?? "0.0.0.0:51907"
export const EXTERNAL_SERVER_BIND_ADDR =
  process.env.EXTERNAL_SERVER_BIND_ADDR ?? "0.0.0.0:51908"

if (TLS_ON) {
  if (VERIFY_CLIENT_CERT) {
    A.assertFileExist(CACERT)
  }
  A.assertFileExist(SERVER_CERT)
  A.assertFileExist(SERVER_KEY)
}
