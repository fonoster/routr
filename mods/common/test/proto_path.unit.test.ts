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
import { expect } from "chai"
import { protoPath } from "../src/proto_path"

describe("@routr/common/proto_path", () => {
  it("resolves a core proto to an existing file", () => {
    expect(existsSync(protoPath("processor.proto"))).to.be.true
  })

  it("resolves a Connect proto to an existing file", () => {
    expect(existsSync(protoPath("connect/agents.proto"))).to.be.true
  })

  it("resolves an unknown proto to a path under protos/ without reading it", () => {
    expect(protoPath("missing.proto")).to.match(
      /[/\\]protos[/\\]missing\.proto$/
    )
  })
})
