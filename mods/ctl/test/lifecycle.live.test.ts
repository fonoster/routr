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
// Runs every resource's create, get, describe, update and delete command
// against a live Routr API server. Only the interactive prompts are stubbed;
// the SDK calls and the server are real. Set ROUTR_LIVE_ENDPOINT to run it,
// for example: ROUTR_LIVE_ENDPOINT=localhost:51908 npm run test:live
import * as path from "path"
import { captureOutput } from "@oclif/test"
import { Command, Config } from "@oclif/core"
import { CommonTypes as CT } from "@routr/common"
import chai from "chai"
import sinon from "sinon"
import inquirer from "inquirer"
import SDK from "@routr/sdk"
import AclCreate from "../src/commands/acl/create"
import AclDelete from "../src/commands/acl/delete"
import AclDescribe from "../src/commands/acl/describe"
import AclGet from "../src/commands/acl/get"
import AclUpdate from "../src/commands/acl/update"
import AgentsCreate from "../src/commands/agents/create"
import AgentsDelete from "../src/commands/agents/delete"
import AgentsDescribe from "../src/commands/agents/describe"
import AgentsGet from "../src/commands/agents/get"
import AgentsUpdate from "../src/commands/agents/update"
import CredentialsCreate from "../src/commands/credentials/create"
import CredentialsDelete from "../src/commands/credentials/delete"
import CredentialsDescribe from "../src/commands/credentials/describe"
import CredentialsGet from "../src/commands/credentials/get"
import CredentialsUpdate from "../src/commands/credentials/update"
import DomainsCreate from "../src/commands/domains/create"
import DomainsDelete from "../src/commands/domains/delete"
import DomainsDescribe from "../src/commands/domains/describe"
import DomainsGet from "../src/commands/domains/get"
import DomainsUpdate from "../src/commands/domains/update"
import NumbersCreate from "../src/commands/numbers/create"
import NumbersDelete from "../src/commands/numbers/delete"
import NumbersDescribe from "../src/commands/numbers/describe"
import NumbersGet from "../src/commands/numbers/get"
import NumbersUpdate from "../src/commands/numbers/update"
import PeersCreate from "../src/commands/peers/create"
import PeersDelete from "../src/commands/peers/delete"
import PeersDescribe from "../src/commands/peers/describe"
import PeersGet from "../src/commands/peers/get"
import PeersUpdate from "../src/commands/peers/update"
import TrunksCreate from "../src/commands/trunks/create"
import TrunksDelete from "../src/commands/trunks/delete"
import TrunksDescribe from "../src/commands/trunks/describe"
import TrunksGet from "../src/commands/trunks/get"
import TrunksUpdate from "../src/commands/trunks/update"

const expect = chai.expect
const sandbox = sinon.createSandbox()
const endpoint = process.env.ROUTR_LIVE_ENDPOINT
const conn = { endpoint, insecure: true }
const stamp = Date.now().toString()
const suffix = Date.now().toString(36)
const name = (resource: string) => `Live ${resource} ${suffix}`

type CommandClass = typeof Command & {
  run(argv: string[], config: Config): Promise<unknown>
}

const describeLive = endpoint ? describe : describe.skip

// Runs steps one after another; the house rules forbid loops.
const sequentially = <T>(items: T[], step: (item: T) => Promise<void>) =>
  items.reduce((prev, item) => prev.then(() => step(item)), Promise.resolve())

describeLive("@routr/ctl/lifecycle (live)", () => {
  let config: Config
  const refs: Record<string, string> = {}

  const run = async (cmd: CommandClass, ...args: string[]) => {
    const out = await captureOutput(
      async () =>
        cmd.run([...args, "--insecure", `--endpoint=${endpoint}`], config),
      { print: false }
    )
    if (out.error) throw out.error
    return `${out.stdout}${out.stderr}`
  }

  // Answers the interactive prompts in order, as a user would.
  const answer = (...groups: Record<string, unknown>[]) => {
    sandbox.restore()
    const prompt = sandbox.stub(inquirer, "prompt")
    groups.forEach((group, i) => prompt.onCall(i).resolves(group))
  }

  before(async () => {
    config = await Config.load(path.join(__dirname, ".."))
  })

  afterEach(() => sandbox.restore())

  after(async () => {
    // Best-effort cleanup if a test failed midway, dependents first.
    const order: [string, string, string][] = [
      ["peer", "Peers", "deletePeer"],
      ["agent", "Agents", "deleteAgent"],
      ["domain", "Domains", "deleteDomain"],
      ["number", "Numbers", "deleteNumber"],
      ["trunk", "Trunks", "deleteTrunk"],
      ["credentials", "Credentials", "deleteCredentials"],
      ["acl", "Acls", "deleteAcl"]
    ]
    await sequentially(
      order.filter(([key]) => refs[key]),
      async ([key, api, fn]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = new (SDK as any)[api](conn)
        await client[fn](refs[key]).catch((): void => undefined)
      }
    )
  })

  it("creates an ACL, then gets, describes and updates it", async () => {
    answer({
      name: name("ACL"),
      deny: "0.0.0.0/0",
      allow: "10.0.0.0/8, 192.168.1.0/24",
      confirm: true
    })
    await run(AclCreate)

    const { items } = await new SDK.Acls(conn).listAcls({
      pageSize: 100,
      pageToken: ""
    })
    const acl = items.find((a) => a.name === name("ACL"))
    expect(acl, "ACL persisted").to.exist
    refs.acl = acl.ref
    expect(acl.allow).to.deep.equal(["10.0.0.0/8", "192.168.1.0/24"])

    expect(await run(AclGet)).to.contain(name("ACL"))
    const described = await run(AclDescribe, acl.ref)
    expect(described).to.contain(acl.ref)
    expect(described).to.contain("192.168.1.0/24")

    answer({
      name: `${name("ACL")} v2`,
      deny: "0.0.0.0/0",
      allow: "10.0.0.0/8",
      confirm: true
    })
    await run(AclUpdate, acl.ref)
    const updated = await new SDK.Acls(conn).getAcl(acl.ref)
    expect(updated.name).to.equal(`${name("ACL")} v2`)
    expect(updated.allow).to.deep.equal(["10.0.0.0/8"])
  })

  it("creates Credentials, then gets, describes and updates them", async () => {
    answer({
      name: name("Credentials"),
      username: `live${suffix}`,
      password: "s3cr3t-pass",
      confirm: true
    })
    await run(CredentialsCreate)

    const { items } = await new SDK.Credentials(conn).listCredentials({
      pageSize: 100,
      pageToken: ""
    })
    const credentials = items.find((c) => c.name === name("Credentials"))
    expect(credentials, "Credentials persisted").to.exist
    refs.credentials = credentials.ref

    expect(await run(CredentialsGet)).to.contain(name("Credentials"))
    const described = await run(CredentialsDescribe, credentials.ref)
    expect(described).to.contain(`live${suffix}`)
    expect(described).to.not.contain("s3cr3t-pass")

    answer({
      name: `${name("Credentials")} v2`,
      username: `live${suffix}`,
      password: "",
      confirm: true
    })
    await run(CredentialsUpdate, credentials.ref)
    const updated = await new SDK.Credentials(conn).getCredentials(
      credentials.ref
    )
    expect(updated.name).to.equal(`${name("Credentials")} v2`)
  })

  it("creates a Trunk with an outbound URI, then gets, describes and updates it", async () => {
    answer(
      {
        name: name("Trunk"),
        inboundUri: `t${suffix}.sip.example.com`,
        accessControlListRef: refs.acl,
        inboundCredentialsRef: undefined,
        outboundCredentialsRef: refs.credentials,
        sendRegister: false,
        addOutboundUri: true
      },
      {
        host: "sip.carrier.example.com",
        port: "5060",
        transport: CT.Transport.UDP,
        user: "",
        priority: "10",
        weight: "10",
        addOutboundUri: false
      },
      { confirm: true }
    )
    await run(TrunksCreate)

    const { items } = await new SDK.Trunks(conn).listTrunks({
      pageSize: 100,
      pageToken: ""
    })
    const trunk = items.find((t) => t.name === name("Trunk"))
    expect(trunk, "Trunk persisted").to.exist
    refs.trunk = trunk.ref
    expect(trunk.uris).to.have.lengthOf(1)
    expect(trunk.uris[0].host).to.equal("sip.carrier.example.com")

    expect(await run(TrunksGet)).to.contain(name("Trunk"))
    const described = await run(TrunksDescribe, trunk.ref)
    expect(described).to.contain("sip.carrier.example.com")

    answer(
      {
        name: `${name("Trunk")} v2`,
        inboundUri: `t${suffix}.sip.example.com`,
        accessControlListRef: refs.acl,
        inboundCredentialsRef: "",
        outboundCredentialsRef: refs.credentials,
        sendRegister: false,
        addOutboundUri: true
      },
      {
        host: "sip2.carrier.example.com",
        port: "5080",
        transport: CT.Transport.TCP,
        user: "",
        priority: "20",
        weight: "20",
        addOutboundUri: false
      },
      { confirm: true }
    )
    await run(TrunksUpdate, trunk.ref)
    const updated = await new SDK.Trunks(conn).getTrunk(trunk.ref)
    expect(updated.name).to.equal(`${name("Trunk")} v2`)
    expect(updated.uris.map((u) => u.host)).to.include(
      "sip2.carrier.example.com"
    )
  })

  it("creates a Number on the Trunk, then gets, describes and updates it", async () => {
    answer({
      name: name("Number"),
      telUrl: `tel:+1${stamp.slice(-10)}`,
      aorLink: `sip:live${suffix}@sip.local`,
      trunkRef: refs.trunk,
      city: "Durham",
      countryIsoCode: "US",
      sessionAffinityHeader: "",
      extraHeaders: "X-Live: yes",
      confirm: true
    })
    await run(NumbersCreate)

    const { items } = await new SDK.Numbers(conn).listNumbers({
      pageSize: 100,
      pageToken: ""
    })
    const number = items.find((n) => n.name === name("Number"))
    expect(number, "Number persisted").to.exist
    refs.number = number.ref
    expect(number.trunk?.ref).to.equal(refs.trunk)

    expect(await run(NumbersGet)).to.contain(name("Number"))
    const described = await run(NumbersDescribe, number.ref)
    expect(described).to.contain(`sip:live${suffix}@sip.local`)

    answer({
      name: `${name("Number")} v2`,
      aorLink: `sip:live2${suffix}@sip.local`,
      trunkRef: refs.trunk,
      sessionAffinityHeader: "",
      extraHeaders: "X-Live: yes",
      confirm: true
    })
    await run(NumbersUpdate, number.ref)
    const updated = await new SDK.Numbers(conn).getNumber(number.ref)
    expect(updated.name).to.equal(`${name("Number")} v2`)
    expect(updated.aorLink).to.equal(`sip:live2${suffix}@sip.local`)
  })

  it("creates a Domain with an egress rule, then gets, describes and updates it", async () => {
    answer(
      {
        name: name("Domain"),
        domainUri: `d${suffix}.sip.local`,
        accessControlListRef: refs.acl,
        addEgressRule: true
      },
      { numberRef: refs.number, rule: ".*", addEgressRule: false },
      { confirm: true }
    )
    await run(DomainsCreate)

    const { items } = await new SDK.Domains(conn).listDomains({
      pageSize: 100,
      pageToken: ""
    })
    const domain = items.find((d) => d.name === name("Domain"))
    expect(domain, "Domain persisted").to.exist
    refs.domain = domain.ref
    expect(domain.egressPolicies.map((p) => p.numberRef)).to.deep.equal([
      refs.number
    ])

    expect(await run(DomainsGet)).to.contain(name("Domain"))
    const described = await run(DomainsDescribe, domain.ref)
    expect(described).to.contain(`d${suffix}.sip.local`)
    expect(described).to.contain(refs.number)

    answer(
      {
        name: `${name("Domain")} v2`,
        accessControlListRef: refs.acl,
        addEgressRule: false
      },
      { confirm: true }
    )
    await run(DomainsUpdate, domain.ref)
    const updated = await new SDK.Domains(conn).getDomain(domain.ref)
    expect(updated.name).to.equal(`${name("Domain")} v2`)
  })

  it("creates an Agent in the Domain, then gets, describes and updates it", async () => {
    answer({
      name: name("Agent"),
      domainRef: refs.domain,
      username: `agent${suffix}`,
      credentialsRef: refs.credentials,
      maxContacts: "3",
      privacy: "None",
      enabled: true,
      confirm: true
    })
    await run(AgentsCreate)

    const { items } = await new SDK.Agents(conn).listAgents({
      pageSize: 100,
      pageToken: ""
    })
    const agent = items.find((a) => a.name === name("Agent"))
    expect(agent, "Agent persisted").to.exist
    refs.agent = agent.ref
    expect(agent.maxContacts).to.equal(3)
    expect(agent.domain?.ref).to.equal(refs.domain)

    expect(await run(AgentsGet)).to.contain(name("Agent"))
    const described = await run(AgentsDescribe, agent.ref)
    expect(described).to.contain(`agent${suffix}`)

    answer({
      name: `${name("Agent")} v2`,
      domainRef: refs.domain,
      credentialsRef: refs.credentials,
      maxContacts: "5",
      privacy: "Private",
      enabled: false,
      confirm: true
    })
    await run(AgentsUpdate, agent.ref)
    const updated = await new SDK.Agents(conn).getAgent(agent.ref)
    expect(updated.name).to.equal(`${name("Agent")} v2`)
    expect(updated.maxContacts).to.equal(5)
    expect(updated.enabled).to.equal(false)
  })

  it("creates a Peer, then gets, describes and updates it", async () => {
    answer({
      name: name("Peer"),
      username: `peer${suffix}`,
      aor: `backend:peer${suffix}`,
      contactAddr: "10.0.0.5:5060",
      maxContacts: "2",
      accessControlListRef: refs.acl,
      credentialsRef: refs.credentials,
      withSessionAffinity: false,
      balancingAlgorithm: "ROUND_ROBIN",
      enabled: true,
      confirm: true
    })
    await run(PeersCreate)

    const { items } = await new SDK.Peers(conn).listPeers({
      pageSize: 100,
      pageToken: ""
    })
    const peer = items.find((p) => p.name === name("Peer"))
    expect(peer, "Peer persisted").to.exist
    refs.peer = peer.ref
    expect(peer.maxContacts).to.equal(2)

    expect(await run(PeersGet)).to.contain(name("Peer"))
    const described = await run(PeersDescribe, peer.ref)
    expect(described).to.contain(`backend:peer${suffix}`)

    answer({
      name: `${name("Peer")} v2`,
      aor: `backend:peer${suffix}`,
      contactAddr: "10.0.0.6:5060",
      maxContacts: "4",
      accessControlListRef: refs.acl,
      credentialsRef: refs.credentials,
      withSessionAffinity: true,
      balancingAlgorithm: "LEAST_SESSIONS",
      enabled: true,
      confirm: true
    })
    await run(PeersUpdate, peer.ref)
    const updated = await new SDK.Peers(conn).getPeer(peer.ref)
    expect(updated.name).to.equal(`${name("Peer")} v2`)
    expect(updated.contactAddr).to.equal("10.0.0.6:5060")
    expect(updated.maxContacts).to.equal(4)
  })

  it("deletes every resource, dependents first", async () => {
    const steps: [string, CommandClass, CommandClass][] = [
      ["peer", PeersDelete, PeersGet],
      ["agent", AgentsDelete, AgentsGet],
      ["domain", DomainsDelete, DomainsGet],
      ["number", NumbersDelete, NumbersGet],
      ["trunk", TrunksDelete, TrunksGet],
      ["credentials", CredentialsDelete, CredentialsGet],
      ["acl", AclDelete, AclGet]
    ]
    await sequentially(steps, async ([key, del, get]) => {
      expect(refs[key], `${key} was created`).to.be.a("string")
      expect(await run(del, refs[key])).to.contain("Done")
      expect(await run(get)).to.not.contain(suffix)
      delete refs[key]
    })
  })

  it("refuses to delete without a ref", async () => {
    let error: Error
    try {
      await run(AclDelete)
    } catch (e) {
      error = e
    }
    expect(error?.message).to.contain("You must provide a resource ref")
  })
})
