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
import { Assertions as A, parseBooleanEnv } from "@routr/common"

A.assertEnvsAreSet(["PATH_TO_RESOURCES"])

export const BIND_ADDR = process.env.BIND_ADDR ?? "0.0.0.0:51907"
export const PATH_TO_RESOURCES = process.env.PATH_TO_RESOURCES
// A Number's telUrl must be tel:+E.164. Off by default
export const REQUIRE_E164_NUMBERS = parseBooleanEnv(
  "REQUIRE_E164_NUMBERS",
  process.env.REQUIRE_E164_NUMBERS
)
