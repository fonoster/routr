/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Resources Module"
 */
import ResourcesUtil from 'resources/utils'
import AgentsAPI from 'resources/agents_api'
import GatewaysAPI from 'resources/gateways_api'
import DomainsAPI from 'resources/domains_api'

export let testGroup = { name: "Resources Module" }

const rUtil = new ResourcesUtil()
const agentsApi = new AgentsAPI()
const gwsAPI = new GatewaysAPI()
const domainsAPI = new DomainsAPI()

// Tests
testGroup.is_jason = function () {
    assertTrue(rUtil.isJson("{}"))
    assertFalse(rUtil.isJson(""))
}

testGroup.yaml_from_file = function () {
    const jsonObj = rUtil.getJsonString('config/agents.yml')
    assertTrue(rUtil.isJson(jsonObj))
}

testGroup.validate_resource = function () {
    const valid = rUtil.isResourceValid('etc/schemas/agents_schema.json', 'config/agents.yml')
    assertTrue(valid)
}

testGroup.get_objs = function () {
    let result = rUtil.getObjs('config/agents.yml')
    assertTrue(result.status == 200)
    // Existing Agent
    result = rUtil.getObjs('config/agents.yml', "@.spec.credentials.username=='john'")
    assertTrue(result.status == 200)
    // Non-Existing Agent
    result = rUtil.getObjs('config/agents.yml', "@.spec.credentials.username=='jhon'")
    assertTrue(result.status == 404)
    // Invalid filter
    result = rUtil.getObjs('config/agents.yml', "@.spec.credentials.username==jhon'")
    assertTrue(result.status == 400)
}

// This also validates the other resources
testGroup.get_agents = function () {
    // NOTE: The space will not work in the console because is considered another parameter
    const result = agentsApi.getAgents("@.spec.credentials.username=='john' || @.spec.credentials.username=='janie'")
    assertTrue(result.status == 200)
    assertTrue(result.obj.length == 2)
}

// This also validates the other resources
testGroup.get_agent = function () {
    const result = agentsApi.getAgent('sip.ocean.com', 'janie')
    assertTrue(result.status == 200)
    assertTrue(result.obj.kind == 'Agent')
}

// This also validates the other resources
testGroup.get_gw_by_ref = function () {
    const result = gwsAPI.getGWByRef('GW0001')
    assertTrue(result.status == 200)
    assertTrue(result.obj.kind == 'Gateway')
}

// This also validates the other resources
testGroup.get_aor = function () {
    const SipFactory = Packages.javax.sip.SipFactory
    const addressFactory = SipFactory.getInstance().createAddressFactory()
    const aor = addressFactory.createSipURI('john', 'sip.ocean.com')
    const result = domainsAPI.getRouteForAOR(aor)
    assertTrue(result.status == 200)
}
