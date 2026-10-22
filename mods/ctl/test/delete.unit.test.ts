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
import AclDelete from "../src/commands/acl/delete"
import AgentsDelete from "../src/commands/agents/delete"
import CredentialsDelete from "../src/commands/credentials/delete"
import DomainsDelete from "../src/commands/domains/delete"
import NumbersDelete from "../src/commands/numbers/delete"
import PeersDelete from "../src/commands/peers/delete"
import TrunksDelete from "../src/commands/trunks/delete"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()
const ref = "ab2b6959-f497-4b14-903b-85a7c464b564"

const cases = [
  { id: "acl", cmd: AclDelete, api: SDK.Acls, method: "deleteAcl" },
  { id: "agents", cmd: AgentsDelete, api: SDK.Agents, method: "deleteAgent" },
  {
    id: "credentials",
    cmd: CredentialsDelete,
    api: SDK.Credentials,
    method: "deleteCredentials"
  },
  {
    id: "domains",
    cmd: DomainsDelete,
    api: SDK.Domains,
    method: "deleteDomain"
  },
  {
    id: "numbers",
    cmd: NumbersDelete,
    api: SDK.Numbers,
    method: "deleteNumber"
  },
  { id: "peers", cmd: PeersDelete, api: SDK.Peers, method: "deletePeer" },
  { id: "trunks", cmd: TrunksDelete, api: SDK.Trunks, method: "deleteTrunk" }
]

describe("@routr/ctl/delete", () => {
  let config: Config

  before(async () => {
    config = await Config.load(path.join(__dirname, ".."))
  })

  afterEach(() => sandbox.restore())

  cases.forEach(({ id, cmd, api, method }) => {
    it(`${id} delete accepts a ref and calls ${method}`, async () => {
      const remove = sandbox
        .stub(api.prototype as never, method as never)
        .resolves()

      const { error, stderr } = await captureOutput(
        async () =>
          cmd.run([ref, "--insecure", "--endpoint=localhost:51908"], config),
        { print: false }
      )

      expect(error).to.be.undefined
      expect(remove).to.have.been.calledOnceWith(ref)
      expect(stderr).to.contain("Done")
    })
  })

  it("refuses to delete without a ref", async () => {
    const remove = sandbox.stub(SDK.Acls.prototype, "deleteAcl").resolves()

    const { error } = await captureOutput(
      async () => AclDelete.run(["--insecure"], config),
      { print: false }
    )

    expect(error?.message).to.contain("You must provide a resource ref")
    expect(remove).to.not.have.been.called
  })
})
