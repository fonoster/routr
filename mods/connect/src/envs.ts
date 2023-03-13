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
import { assertOnlyOneEnvIsSet } from "./assertions"

assertOnlyOneEnvIsSet(["CONNECT_VERIFIER_ADDR", "CONNECT_VERIFIER_PUBLIC_KEY"])

export const BIND_ADDR = process.env.BIND_ADDR ?? "0.0.0.0:51904"
export const LOCATION_ADDR = process.env.LOCATION_ADDR
export const API_ADDR = process.env.API_ADDR
export const CONNECT_VERIFIER_ADDR = process.env.CONNECT_VERIFIER_ADDR
export const CONNECT_VERIFIER_PUBLIC_KEY_PATH =
  process.env.CONNECT_VERIFIER_PUBLIC_KEY_PATH
export const CONNECT_VERIFIER_OPTIONS = process.env.CONNECT_VERIFIER_OPTIONS
  ? JSON.parse(process.env.CONNECT_VERIFIER_OPTIONS)
  : { expiresIn: "1h", algorithm: ["RS256"] }
