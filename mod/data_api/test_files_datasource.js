/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Resources Module"
 */
import FilesDataSource from 'data_api/files_datasource'
import FilesUtil from 'utils/files_util'
import DSUtil from 'data_api/utils'
import AgentsAPI from 'data_api/agents_api'
import GatewaysAPI from 'data_api/gateways_api'
import DomainsAPI from 'data_api/domains_api'
import DIDsAPI from 'data_api/dids_api'
import UsersAPI from 'data_api/users_api'
import { Status } from 'data_api/status'
import getConfig from 'core/config_util.js'

export let testGroup = { name: "Files Data Source" }

const config = getConfig()
// Forces data source to use its own default parameters...
delete config.spec.dataSource.parameters

const ds = new FilesDataSource(config)
const agentsApi = new AgentsAPI(ds)
const gwsAPI = new GatewaysAPI(ds)
const domainsAPI = new DomainsAPI(ds)
const didsAPI = new DIDsAPI(ds)
const usersAPI = new UsersAPI(ds)
const SipFactory = Packages.javax.sip.SipFactory
const addressFactory = SipFactory.getInstance().createAddressFactory()

testGroup.yaml_from_file = function () {
    const jsonObj = DSUtil.convertToJson(FilesUtil.readFile('config/agents.yml'))
    assertTrue(jsonObj instanceof Object)
}

testGroup.validate_resource = function () {
    const valid = DSUtil.isValidDataSource('etc/schemas/agents_schema.json', FilesUtil.readFile('config/agents.yml'))
    assertTrue(valid)
}

testGroup.get_collections = function () {
    let response = ds.withCollection('agents').find()
    assertTrue(response.status == Status.OK)
    // Existing Agent
    response = ds.withCollection('agents').find("@.spec.credentials.username=='1001'")
    assertTrue(response.status == Status.OK)
    // Non-Existing Agent
    response = ds.withCollection('agents').find("@.spec.credentials.username=='mike'")
    assertTrue(response.result.length == 0)
    // Invalid filter
    response = ds.withCollection('agents').find("@.spec.credentials.username==1001'")
    assertTrue(response.status == Status.BAD_REQUEST)
}


// This also validates the other resources
testGroup.get_agents = function () {
    // NOTE: The space will not work in the console because the second part is considered another parameter
    const response = agentsApi.getAgents("@.spec.credentials.username=='1001' || @.spec.credentials.username=='1002'")
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.length == 2)
}

// This also validates the other resources
testGroup.get_agent = function () {
    const response = agentsApi.getAgent('ag3f77f6')
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.kind == 'Agent')
}

// This also validates the other resources
testGroup.get_gw= function () {
    const response = gwsAPI.getGateway('gweef506')
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.kind == 'Gateway')
}

// This also validates the other resources
testGroup.get_did_by_tel_url = function () {
    const telURL = addressFactory.createTelURL('0000000000')
    const response = didsAPI.getDIDByTelUrl(telURL)
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.kind == 'DID')
}

// This also validates the other resources
testGroup.get_users = function () {
    const response = usersAPI.getUsers("@.spec.credentials.username=='admin'")
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.length == 1)
}

// This also validates the other resources
testGroup.get_user_by_username = function () {
    const response = usersAPI.getUserByUsername('admin')
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.kind == 'User')
}
