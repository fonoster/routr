/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Fonoster Resources Module"
 */
import DSUtil from 'ext/rest_data_provider/utils'
import AgentsAPI from 'ext/rest_data_provider/agents_api'
import DomainsAPI from 'ext/rest_data_provider/domains_api'
import DIDsAPI from 'ext/rest_data_provider/dids_api'
import GatewaysAPI from 'ext/rest_data_provider/gateways_api'
import { Status } from 'data_provider/status'

export let testGroup = { name: "Rest Data Provider" }

const dsUtil = new DSUtil()
const agentsAPI = new AgentsAPI()
const domainsAPI = new DomainsAPI()
const didsAPI = new DIDsAPI()
const gatewaysAPI = new GatewaysAPI()
const SipFactory = Packages.javax.sip.SipFactory
const addressFactory = SipFactory.getInstance().createAddressFactory()

testGroup.get_objs = function () {
    let result = dsUtil.getObjs('agents','*')
    assertTrue(result.status == Status.OK)
    result = dsUtil.getObjs('dids','*')
    assertTrue(result.status == Status.OK)
    result = dsUtil.getObjs('gateways','*')
    assertTrue(result.status == Status.OK)
    // Test for space
    result = dsUtil.getObjs('agents',"@.spec.credentials.username=='john'|| @.spec.credentials.username=='janie'")
    assertTrue(result.status == Status.OK)
    // Existing Agent
    result = dsUtil.getObjs('agents', "@.spec.credentials.username=='john'")
    assertTrue(result.status == Status.OK)
    // Non-Existing Agent
    result = dsUtil.getObjs('agents', "@.spec.credentials.username=='jhon'")
    assertTrue(result.status == Status.NOT_FOUND)
    // Invalid filter
    result = dsUtil.getObjs('agents', "@.spec.credentials.username==jhon'")
    assertTrue(result.status == Status.BAD_REQUEST)
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
    assertTrue(response.result.length == 1)
}

// This also validates the other resources
testGroup.get_did = function () {
    const response = didsAPI.getDID('595be81d92bccf194b16645e')
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
    assertTrue(response.result.length == 1)
}

// This also validates the other resources
testGroup.unsupported_action = function () {
    const response = agentsAPI.createAgent()
    assertTrue(response.status == Status.NOT_SUPPORTED)
}
