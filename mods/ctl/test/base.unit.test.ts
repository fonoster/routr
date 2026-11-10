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
import * as fs from "fs"
import * as path from "path"
import { captureOutput } from "@oclif/test"
import { Command, Config } from "@oclif/core"
import inquirer from "inquirer"
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import SDK from "@routr/sdk"
import GetCommand from "../src/commands/agents/get"
import { BaseCommand } from "../src/base"

chai.use(sinonChai)
const expect = chai.expect
const sandbox = sinon.createSandbox()

const CACERT = path.join(__dirname, "../../sdk/test/fixtures/ca.crt")
const MISSING = path.join(__dirname, "fixtures", "no-such-ca.crt")
const BOTH =
  "insecure and cacert can't be used together: insecure is plaintext and would ignore the CA certificate. Remove insecure (--insecure in rctl) to verify the server with the cacert, or remove cacert (--cacert in rctl) for plaintext."

// Every resource command: the commands of src/commands but the trace ones,
// which take their own --insecure and --cacert
const COMMANDS = path.join(__dirname, "..", "src", "commands")
const resourceCommands = fs
  .readdirSync(COMMANDS)
  .filter((kind) => kind !== "trace")
  .flatMap((kind) =>
    fs.readdirSync(path.join(COMMANDS, kind)).map((file) => ({
      id: `${kind} ${path.basename(file, ".ts")}`,
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      load: () => require(path.join(COMMANDS, kind, file)).default
    }))
  )

type RunnableCommand = typeof Command & {
  run(argv: string[], config: Config): Promise<unknown>
}

// One placeholder for each argument the command declares
const placeholders = (cmd: typeof Command) =>
  Object.keys(cmd.args ?? {}).map(() => "ab2b6959")

const exitOf = (error?: Error) =>
  (error as { oclif?: { exit?: number } })?.oclif?.exit

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

  describe("the credentials pre-flight", () => {
    const env = {
      ALLOW_INSECURE: process.env.ALLOW_INSECURE,
      ROUTR_API_KEY: process.env.ROUTR_API_KEY
    }
    let exit: sinon.SinonStub

    beforeEach(() => {
      delete process.env.ALLOW_INSECURE
      delete process.env.ROUTR_API_KEY
      // The SDK used to end the process on a missing CA certificate; a
      // regression must fail a test, not end mocha
      exit = sandbox.stub(process, "exit")
    })

    afterEach(() => {
      Object.entries(env).forEach(([name, value]) => {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      })
    })

    it("covers the 35 resource commands", () => {
      expect(resourceCommands).to.have.lengthOf(35)
    })

    resourceCommands.forEach(({ id, load }) => {
      it(`${id} refuses insecure with a cacert`, async () => {
        const cmd = load() as RunnableCommand
        const { error } = await captureOutput(async () =>
          cmd.run(
            [...placeholders(cmd), "--insecure", "--cacert", CACERT],
            config
          )
        )
        expect(error?.message).to.equal(BOTH)
        expect(exitOf(error)).to.equal(2)
      })
    })

    it("agents get builds no client on insecure with a cacert", async () => {
      const agents = sandbox.stub(SDK, "Agents")
      const { error } = await captureOutput(async () =>
        GetCommand.run(["--insecure", "--cacert", CACERT], config)
      )
      expect(error?.message).to.equal(BOTH)
      expect(agents).to.have.callCount(0)
    })

    it("agents create prompts nothing on insecure with a cacert", async () => {
      const domains = sandbox.stub(SDK, "Domains")
      const prompt = sandbox.stub(inquirer, "prompt")
      const create = resourceCommands.find((c) => c.id === "agents create")
      const { error } = await captureOutput(async () =>
        (create?.load() as RunnableCommand).run(
          ["--insecure", "--cacert", CACERT],
          config
        )
      )
      expect(error?.message).to.equal(BOTH)
      expect(exitOf(error)).to.equal(2)
      expect(domains).to.have.callCount(0)
      expect(prompt).to.have.callCount(0)
    })

    const kinds = [
      "acl get",
      "agents get",
      "credentials get",
      "domains get",
      "numbers get",
      "peers get",
      "trunks get",
      "agents describe"
    ]

    kinds.forEach((id) => {
      it(`${id} exits 1 on a missing cacert`, async () => {
        const cmd = resourceCommands
          .find((c) => c.id === id)
          ?.load() as RunnableCommand
        const { error } = await captureOutput(async () =>
          cmd.run([...placeholders(cmd), "--cacert", MISSING], config)
        )
        expect(error?.message).to.equal(`the file ${MISSING} does not exist`)
        expect(exitOf(error)).to.equal(1)
        expect(exit).to.have.callCount(0)
      })
    })
  })
})
