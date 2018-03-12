/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Fonoster Resources Module"
 */
import RestfulDataSource from 'data_api/restful_datasource'
import AgentsAPI from 'data_api/agents_api'
import DomainsAPI from 'data_api/domains_api'
import DIDsAPI from 'data_api/dids_api'
import GatewaysAPI from 'data_api/gateways_api'
import PeersAPI from 'data_api/peers_api'
import UsersAPI from 'data_api/users_api'
import { Status } from 'data_api/status'
import getConfig from 'core/config_util.js'

export let testGroup = { name: "Restful Data Source" }

const config = getConfig()
// Forces data source to use its own default parameters...
delete config.spec.dataSource.parameters

const ds = new RestfulDataSource(config)

const agentsAPI = new AgentsAPI(ds)
const domainsAPI = new DomainsAPI(ds)
const didsAPI = new DIDsAPI(ds)
const gatewaysAPI = new GatewaysAPI(ds)
const SipFactory = Packages.javax.sip.SipFactory
const addressFactory = SipFactory.getInstance().createAddressFactory()
const ObjectId = Packages.org.bson.types.ObjectId

testGroup.basic_operations = function () {
    let agent = {
        apiVersion: 'v1.0',
        kind: "Agent",
        metadata: {
            name: "John Doe",
            userId: 'john@doe.com'
        },
        spec: {
            domains: ['sip.local'],
            credentials: {
                username: '1001',
                secret: 'secret'
            }
        }
    }

    const initSize = ds.withCollection('agents').find().result.length
    let response = ds.insert(agent)
    const ref = response.result
    let endSize = ds.withCollection('agents').find().result.length

    assertTrue(ObjectId.isValid(ref))
    assertTrue(endSize == (initSize + 1))
    assertTrue(agent.metadata.name.equals("John Doe"))

    agent.metadata.name = "Jae Doe"
    agent.metadata.ref = ref
    response = ds.update(agent)
    assertTrue(response.status == Status.OK)

    response = ds.withCollection('agents').remove(ref)
    assertTrue(response.status == Status.OK)

    response =  ds.withCollection('agents').find()
    endSize = response.result.length
    assertTrue (initSize == endSize)
}

testGroup.get_collections = function () {
let response = ds.withCollection('agents').find('*')
    assertTrue(response.status == Status.OK)

    response = ds.withCollection('dids').find('*')
    assertTrue(response.status == Status.OK)

    response = ds.withCollection('agents').find("@.spec.credentials.username=='john'|| @.spec.credentials.username=='janie'")
    assertTrue(response.status == Status.OK)

    response = ds.withCollection('agents').find("@.spec.credentials.username=='john'")
    assertTrue(response.status == Status.OK)

    response = ds.withCollection('agents').find("@.spec.credentials.username=='jhon'")
    assertTrue(response.status == Status.NOT_FOUND)

    response = ds.withCollection('agents').find("@.spec.credentials.username==jhon'")
    assertTrue(response.status == Status.BAD_REQUEST)
}

// This also validates the other resources
testGroup.get_agents = function () {
    // NOTE: The space will not work in the console because is considered another parameter
    const response = agentsAPI.getAgents("@.spec.credentials.username=='john' || @.spec.credentials.username=='janie'")
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.length == 2)
}

// This also validates the other resources
testGroup.get_agent = function () {
    const response = agentsAPI.getAgent('sip.ocean.com', 'janie')
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.kind == 'Agent')
}

// This also validates the other resources
testGroup.get_dids = function () {
    const response = didsAPI.getDIDs()
    assertTrue(response.status == Status.OK)
}

// This also validates the other resources
testGroup.get_did = function () {
    const response = didsAPI.getDID('595bc68592bccf1454883d0c')
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.kind == 'DID')
}

// This also validates the other resources
testGroup.get_did_by_tel_url = function () {
    const telURL = addressFactory.createTelURL('17066041487')
    const response = didsAPI.getDIDByTelUrl(telURL)
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.kind == 'DID')
}

// This also validates the other resources
testGroup.get_gateways = function () {
    const response = gatewaysAPI.getGateways()
    assertTrue(response.status == Status.OK)
}

// This also validates the other resources
testGroup.update_gateway = function () {
    let gateway = {
        apiVersion: 'v1draft1',
        kind: 'Gateway',
        metadata: {
            spId: '507f1f77bcf86cd799439011',
            name: 'Voip2 MS',
            ref: 'GW0001'
        },
        spec: {
            regService: {
                transport: 'tcp',
                host: 'atlanta13.voip.ms',
                credentials: {
                    username: '215706',
                    secret: 'iymscvb4rUSG4T0P4RD0'
                }
            }
        }
    }

    let response = ds.insert(gateway)
    const ref = response.result
    assertTrue(response.status == Status.CREATED)

    gateway.metadata.name = 'Voip Change'
    gateway.metadata.ref = ref
    response = ds.update(gateway)

    assertTrue(response.status == Status.OK)
    response = ds.withCollection('gateways').remove(ref)
    assertTrue(response.status == Status.OK)
}

// This also validates the other resources
testGroup.update_gateway = function () {
    let gateway = {
        apiVersion: 'v1draft1',
        kind: 'Gateway',
        metadata: {
            spId: '507f1f77bcf86cd799439011',
            name: 'Voip2 MS',
            ref: 'GW0001'
        },
        spec: {
            regService: {
                transport: 'tcp',
                host: 'atlanta13.voip.ms',
                credentials: {
                    username: '215706',
                    secret: 'iymscvb4rUSG4T0P4RD0'
                }
            }
        }
    }

    let response = ds.insert(gateway)
    const ref = response.result
    assertTrue(response.status == Status.CREATED)

    gateway.metadata.name = 'Voip Change'
    gateway.metadata.ref = ref
    response = ds.update(gateway)
    assertTrue(response.status == Status.OK)

    response = ds.withCollection('gateways').remove(ref)
    assertTrue(response.status == Status.OK)
}

// This also validates the other resources
testGroup.update_domain = function () {
    let domain = {
        apiVersion: 'v1draft1',
        kind: 'Domain',
        metadata: {
            name: 'Walmart Local',
            userId: 'john@doe.com'
        },
        spec: {
            context: {
                domainUri: 'sip.local',
                egressPolicy: {
                    rule: '.*',
                    didRef: 'DID0001'
                }
            }
        }
    }

    let response = ds.insert(domain)
    const ref = response.result
    assertTrue(response.status == Status.CREATED)

    domain.metadata.name = 'Walmart2 Local'
    domain.metadata.ref = ref
    response = ds.update(domain)
    assertTrue(response.status == Status.OK)

    response = ds.withCollection('domains').remove(ref)
    assertTrue(response.status == Status.OK)
}

// This also validates the other resources
testGroup.update_did = function () {
    let did = {
        apiVersion: 'v1draft1',
        kind: 'DID',
        metadata: {
            gwRef: '595bc68492bccf1454883d0b',
            geoInfo: {
              city: 'Sanford, GA',
              country: 'United States',
              countryISOCode: 'DR'
            }
        },
        spec: {
            location: {
                telUrl: 'tel:61198972121',
                aorLink: 'sip:1001@sip.local'
            }
        }
    }

    let response = ds.insert(did)
    const ref = response.result
    assertTrue(response.status == Status.CREATED)

    did.metadata.geoInfo.city = 'Cameron, GA'
    did.metadata.ref = ref
    response = ds.update(did)
    assertTrue(response.status == Status.OK)

    response = ds.withCollection('dids').remove(ref)
    assertTrue(response.status == Status.OK)
}

// This also validates the other resources
testGroup.update_peer = function () {
    let peer = {
        apiVersion: 'v1draft1',
        kind: 'Peer',
        metadata: {
            name: 'Ast PBX'
        },
        spec: {
            device: 'sip.local',
            credentials: {
                username: 'ast',
                secret: '1234'
            }
        }
    }

    let response = ds.insert(peer)
    const ref = response.result
    assertTrue(response.status == Status.CREATED)

    peer.metadata.name = 'Asterisk PBX'
    peer.metadata.ref = ref
    response = ds.update(peer)
    assertTrue(response.status == Status.OK)

    response = ds.withCollection('peers').remove(ref)
    assertTrue(response.status == Status.OK)
}