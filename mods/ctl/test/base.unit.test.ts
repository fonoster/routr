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
import sinonChai from "sinon-chai"
import SDK from "@routr/sdk"
import GetCommand from "../src/commands/agents/get"
import { BaseCommand } from "../src/base"

chai.use(sinonChai)
const expect = chai.expect
const sandbox = sinon.createSandbox()

describe("@routr/ctl/base", () => {
  let config: Config

  before(async () => {
    config = await Config.load(path.join(__dirname, ".."))
  })

  afterEach(() => sandbox.restore())

  it("defaults the endpoint to the Data API's port, 51907", () => {
    expect(BaseCommand.baseFlags.endpoint.default).to.equal("localhost:51907")
  })

  it("reaches localhost:51907 when no --endpoint is given", async () => {
    const agents = sandbox
      .stub(SDK, "Agents")
      .returns({ listAgents: sandbox.stub().resolves({ items: [] }) } as never)

    await captureOutput(async () => GetCommand.run(["--insecure"], config))

    expect(agents).to.have.been.calledOnce
    expect(agents.firstCall.args[0]).to.have.property(
      "endpoint",
      "localhost:51907"
    )
  })
})
