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
import GetCommand from "../src/commands/domains/get"

const expect = chai.expect
const sandbox = sinon.createSandbox()

describe("@routr/ctl/domains/get", () => {
  let config: Config

  before(async () => {
    config = await Config.load(path.join(__dirname, ".."))
  })

  afterEach(() => sandbox.restore())

  it("lists Domains in a table", async () => {
    sandbox.stub(SDK.Domains.prototype, "listDomains").resolves({
      items: [
        {
          ref: "ab2b6959-f497-4b14-903b-85a7c464b564",
          name: "Local Domain",
          domainUri: "sip.local",
          egressPolicies: []
        }
      ],
      nextPageToken: ""
    } as never)

    const { stdout } = await captureOutput(async () =>
      GetCommand.run(["--insecure", "--endpoint=localhost:51907"], config)
    )

    expect(stdout).to.contain("Name")
    expect(stdout).to.contain("URI")
    expect(stdout).to.contain("Local Domain")
    expect(stdout).to.contain("sip.local")
  })
})
