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
import { existsSync } from "fs"
import { join } from "path"

// The protos live in protos/ at the repository root, the single source for Go and
// TypeScript. @routr/common's build copies them into dist/protos and dist/connect/protos,
// which is what a packed module reads. Running from src (ts-node, the unit tests) there is
// no copy, so the repository's protos/ is read instead.
export const protoPath = (file: string): string => {
  const copied = file.startsWith("connect/")
    ? join(__dirname, "connect", "protos", file.slice("connect/".length))
    : join(__dirname, "protos", file)
  return existsSync(copied)
    ? copied
    : join(__dirname, "..", "..", "..", "protos", file)
}
