/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import {
  Kind,
  mapToACL,
  mapToCredentials,
  mapToDomain,
  mapToNumber,
  mapToPeer,
  mapToTrunk
} from "../src/connect"
import {
  AccessControlListConfig,
  AgentConfig,
  CredentialsConfig,
  DomainConfig,
  NumberConfig,
  PeerConfig,
  TrunkConfig
} from "../src/connect/config"
import { mapToAgent } from "../src/connect/mappers/agent"
import { Privacy, Transport } from "../src/types"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/common/connect/mappers", () => {
  afterEach(() => sandbox.restore())

  it("validates the agent config with json-schema", () => {
    // Arrange
    const agentConfig: AgentConfig = {
      kind: Kind.AGENT,
      apiVersion: "v2draft1",
      ref: "agent-1",
      metadata: {
        name: "John Doe"
      },
      spec: {
        username: "1001",
        domainRef: "domain-1",
        credentialsRef: "credentials-1",
        privacy: Privacy.NONE,
        enabled: true
      }
    }

    // Act
    const agent = mapToAgent(agentConfig)

    // Assert
    expect(agent).to.have.property("apiVersion", agentConfig.apiVersion)
    expect(agent).to.have.property("ref", agentConfig.ref)
    expect(agent).to.have.property("name", agentConfig.metadata.name)
    expect(agent).to.have.property("username", agentConfig.spec.username)
    expect(agent).to.have.property("domainRef", agentConfig.spec.domainRef)
    expect(agent).to.have.property(
      "credentialsRef",
      agentConfig.spec.credentialsRef
    )
    expect(agent).to.have.property("privacy", agentConfig.spec.privacy)
    expect(agent).to.have.property("enabled", agentConfig.spec.enabled)
  })

  it("validates the peer config with json-schema", () => {
    // Arrange
    const peerConfig: PeerConfig = {
      kind: Kind.PEER,
      apiVersion: "v2draft1",
      ref: "peer-1",
      metadata: {
        name: "peer-1"
      },
      spec: {
        aor: "sip:asterisk@sip.local",
        username: "1001",
        credentialsRef: "credentials-1"
      }
    }

    // Act
    const peer = mapToPeer(peerConfig)

    // Assert
    expect(peer).to.have.property("apiVersion", peerConfig.apiVersion)
    expect(peer).to.have.property("ref", peerConfig.ref)
    expect(peer).to.have.property("name", peerConfig.metadata.name)
    expect(peer).to.have.property("aor", peerConfig.spec.aor)
    expect(peer).to.have.property("username", peerConfig.spec.username)
    expect(peer).to.have.property(
      "credentialsRef",
      peerConfig.spec.credentialsRef
    )
    expect(peer).to.have.property("contactAddr", undefined)
  })

  it("validates the domain config with json-schema", () => {
    // Arrange
    const domainConfig: DomainConfig = {
      kind: Kind.DOMAIN,
      apiVersion: "v2draft1",
      ref: "domain-1",
      metadata: {
        name: "domain-1"
      },
      spec: {
        context: {
          domainUri: "sip.local",
          egressPolicies: [
            {
              rule: ".*",
              numberRef: "number-1"
            }
          ]
        }
      }
    }

    // Act
    const domain = mapToDomain(domainConfig)

    // Assert
    expect(domain).to.have.property("apiVersion", domainConfig.apiVersion)
    expect(domain).to.have.property("ref", domainConfig.ref)
    expect(domain).to.have.property("name", domainConfig.metadata.name)
    expect(domain).to.have.property(
      "domainUri",
      domainConfig.spec.context.domainUri
    )
    expect(domain).to.have.property(
      "egressPolicies",
      domainConfig.spec.context.egressPolicies
    )
  })

  it("validates the number config with json-schema", () => {
    // Arrange
    const numberConfig: NumberConfig = {
      kind: Kind.NUMBER,
      apiVersion: "v2draft1",
      ref: "number-1",
      metadata: {
        name: "number-1",
        geoInfo: {
          country: "United States",
          city: "San Francisco",
          countryISOCode: "US"
        }
      },
      spec: {
        trunkRef: "trunk-1",
        location: {
          sessionAffinityHeader: "X-Session-ID",
          extraHeaders: [{ name: "X-Header-1", value: "value-1" }],
          telUrl: "tel:+14155551212",
          aorLink: "sip:1001@sip.local"
        }
      }
    }

    // Act
    const number = mapToNumber(numberConfig)

    // Assert
    expect(number).to.have.property("apiVersion", numberConfig.apiVersion)
    expect(number).to.have.property("ref", numberConfig.ref)
    expect(number).to.have.property("name", numberConfig.metadata.name)
    expect(number).to.have.property(
      "country",
      numberConfig.metadata.geoInfo.country
    )
    expect(number).to.have.property("city", numberConfig.metadata.geoInfo.city)
    expect(number).to.have.property(
      "countryISOCode",
      numberConfig.metadata.geoInfo.countryISOCode
    )
    expect(number).to.have.property("trunkRef", numberConfig.spec.trunkRef)
    expect(number).to.have.property(
      "sessionAffinityHeader",
      numberConfig.spec.location.sessionAffinityHeader
    )
    expect(number).to.have.property(
      "extraHeaders",
      numberConfig.spec.location.extraHeaders
    )
  })

  it("validates the trunk config with json-schema", () => {
    // Arrange
    const trunkConfig: TrunkConfig = {
      kind: Kind.TRUNK,
      apiVersion: "v2draft1",
      ref: "trunk-1",
      metadata: {
        name: "trunk-1"
      },
      spec: {
        inbound: {
          uri: "trunk01.sip.local",
          accessControlListRef: "acl-1",
          credentialsRef: "credentials-1"
        },
        outbound: {
          sendRegister: true,
          credentialsRef: "credentials-1",
          uris: [
            {
              uri: {
                user: "pbx-1",
                host: "trunk01.sip.local",
                port: 5060,
                transport: Transport.TCP
              },
              priority: 1,
              weight: 1,
              enabled: true
            }
          ]
        }
      }
    }

    // Act
    const trunk = mapToTrunk(trunkConfig)

    // Assert
    expect(trunk).to.have.property("apiVersion", trunkConfig.apiVersion)
    expect(trunk).to.have.property("ref", trunkConfig.ref)
    expect(trunk).to.have.property("name", trunkConfig.metadata.name)
    expect(trunk).to.have.property("inboundUri", trunkConfig.spec.inbound.uri)
    expect(trunk).to.have.property(
      "accessControlListRef",
      trunkConfig.spec.inbound.accessControlListRef
    )
    expect(trunk).to.have.property(
      "inboundCredentialsRef",
      trunkConfig.spec.inbound.credentialsRef
    )
    expect(trunk).to.have.property(
      "sendRegister",
      trunkConfig.spec.outbound.sendRegister
    )
    expect(trunk).to.have.property(
      "outboundCredentialsRef",
      trunkConfig.spec.outbound.credentialsRef
    )
    expect(trunk.uris[0]).to.have.property(
      "enabled",
      trunkConfig.spec.outbound.uris[0].enabled
    )
    expect(trunk.uris[0]).to.have.property(
      "priority",
      trunkConfig.spec.outbound.uris[0].priority
    )
    expect(trunk.uris[0]).to.have.property(
      "weight",
      trunkConfig.spec.outbound.uris[0].weight
    )
    expect(trunk.uris[0]).to.have.property(
      "user",
      trunkConfig.spec.outbound.uris[0].uri.user
    )
    expect(trunk.uris[0]).to.have.property(
      "host",
      trunkConfig.spec.outbound.uris[0].uri.host
    )
    expect(trunk.uris[0]).to.have.property(
      "port",
      trunkConfig.spec.outbound.uris[0].uri.port
    )
    expect(trunk.uris[0]).to.have.property(
      "transport",
      trunkConfig.spec.outbound.uris[0].uri.transport
    )
  })

  it("validates the acl config with json-schema", () => {
    // Arrange
    const aclConfig: AccessControlListConfig = {
      kind: Kind.ACL,
      apiVersion: "v2draft1",
      ref: "acl-1",
      metadata: {
        name: "local access"
      },
      spec: {
        accessControlList: {
          deny: ["0.0.0.0/1"],
          allow: ["192.168.1.3/31"]
        }
      }
    }

    // Act
    const acl = mapToACL(aclConfig)

    // Assert
    expect(acl).to.have.property("apiVersion", aclConfig.apiVersion)
    expect(acl).to.have.property("ref", aclConfig.ref)
    expect(acl).to.have.property("name", aclConfig.metadata.name)
    expect(acl).to.have.property("deny", aclConfig.spec.accessControlList.deny)
    expect(acl).to.have.property(
      "allow",
      aclConfig.spec.accessControlList.allow
    )
  })

  it("validates the credentials config with json-schema", () => {
    // Arrange
    const credentialsConfig: CredentialsConfig = {
      kind: Kind.CREDENTIALS,
      apiVersion: "v2draft1",
      ref: "credentials-1",
      metadata: {
        name: "credentials-1"
      },
      spec: {
        credentials: {
          username: "username",
          password: "password"
        }
      }
    }

    // Act
    const credentials = mapToCredentials(credentialsConfig)

    // Assert
    expect(credentials).to.have.property(
      "apiVersion",
      credentialsConfig.apiVersion
    )
    expect(credentials).to.have.property("ref", credentialsConfig.ref)
    expect(credentials).to.have.property(
      "name",
      credentialsConfig.metadata.name
    )
    expect(credentials).to.have.property(
      "username",
      credentialsConfig.spec.credentials.username
    )
    expect(credentials).to.have.property(
      "password",
      credentialsConfig.spec.credentials.password
    )
  })
})
