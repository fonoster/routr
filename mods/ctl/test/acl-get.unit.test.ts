/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import * as path from "path"
import { captureOutput } from "@oclif/test"
import { Config } from "@oclif/core"
import chai from "chai"
import sinon from "sinon"
import SDK from "@routr/sdk"
import GetCommand from "../src/commands/acl/get"

const expect = chai.expect
const sandbox = sinon.createSandbox()

describe("@routr/ctl/acl/get", () => {
  let config: Config

  before(async () => {
    config = await Config.load(path.join(__dirname, ".."))
  })

  afterEach(() => sandbox.restore())

  it("lists ACLs in a table", async () => {
    sandbox.stub(SDK.Acls.prototype, "listAcls").resolves({
      items: [
        {
          ref: "80181ca6-d4aa-4575-9375-8f72b07d9949",
          name: "PSTN Provider US-CA",
          deny: ["0.0.0.0/0"],
          allow: ["47.132.130.31"]
        }
      ],
      nextPageToken: ""
    } as never)

    const { stdout } = await captureOutput(async () =>
      GetCommand.run(["--insecure", "--endpoint=localhost:51907"], config)
    )

    expect(stdout).to.contain("Name")
    expect(stdout).to.contain("Deny CIDR Networks")
    expect(stdout).to.contain("Allow CIDR Networks")
    expect(stdout).to.contain("PSTN Provider US-CA")
    expect(stdout).to.contain("0.0.0.0/0")
    expect(stdout).to.contain("47.132.130.31")
  })
})
