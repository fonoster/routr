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
import { CommonTypes as CT } from "@routr/common"
import chai from "chai"
import sinon from "sinon"
import SDK from "@routr/sdk"
import GetCommand from "../src/commands/peers/get"

const expect = chai.expect
const sandbox = sinon.createSandbox()

describe("@routr/ctl/peers/get", () => {
  let config: Config

  before(async () => {
    config = await Config.load(path.join(__dirname, ".."))
  })

  afterEach(() => sandbox.restore())

  it("lists Peers in a table", async () => {
    sandbox.stub(SDK.Peers.prototype, "listPeers").resolves({
      items: [
        {
          ref: "6f941c63-880c-419a-a72a-4a107cbaf5c5",
          name: "Asterisk Conference",
          username: "conference",
          aor: "sip:conference@sip.local",
          maxContacts: 1,
          balancingAlgorithm: CT.LoadBalancingAlgorithm.ROUND_ROBIN,
          enabled: true
        }
      ],
      nextPageToken: ""
    } as never)

    const { stdout } = await captureOutput(async () =>
      GetCommand.run(["--insecure", "--endpoint=localhost:51907"], config)
    )

    expect(stdout).to.contain("AOR")
    expect(stdout).to.contain("Balancing Algorithm")
    expect(stdout).to.contain("Asterisk Conference")
    expect(stdout).to.contain("Round Robin")
  })
})
