/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Redis Data Source"
 */
import RedisDataSource from 'data_api/redis_datasource'
import AgentsAPI from 'data_api/agents_api'
import { Status } from 'core/status'
import TestUtils from 'data_api/test_utils.js'
import getConfig from 'core/config_util.js'


const ObjectId = Packages.org.bson.types.ObjectId

export let testGroup = { name: "Redis Data Source", enabled: true }

const config = getConfig()
// To force RedisDataSource to use its own default parameters...
delete config.spec.dataSource.parameters

const ds = new RedisDataSource(config)
const agentsApi = new AgentsAPI(ds)

testGroup.basic_operations = function () {
    const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')

    const initSize = ds.withCollection('agents').find().result.length
    const response = ds.insert(agent)
    let endSize = ds.withCollection('agents').find().result.length

    assertTrue(ObjectId.isValid(response.result))
    assertTrue(endSize == (initSize + 1))
    assertTrue(agent.metadata.name.equals('John Doe'))

    ds.withCollection('agents').remove(response.result)
    endSize = ds.withCollection('agents').find().result.length
    assertTrue (initSize == endSize)
}

testGroup.get_collections = function () {
    const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
    const initSize = ds.withCollection('agents').find().result.length
    const ref = ds.insert(agent).result

    // Existing Agent
    let response = ds.withCollection('agents').find("@.spec.credentials.username==1001")
    assertTrue(response.status == Status.OK)

    // Non-Existing Agent
    response = ds.withCollection('agents').find("@.spec.credentials.username=='peter'")
    assertTrue(response.result.length == 0)

    // Invalid filter
    response = ds.withCollection('agents').find("@.spec.credentials.username==mike'")
    assertTrue(response.status == Status.BAD_REQUEST)

    ds.withCollection('agents').remove(ref)
    const endSize = ds.withCollection('agents').find().result.length
    assertTrue(initSize == endSize)
}

// This also validates the other resources
testGroup.get_agents = function () {
    const john = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
    const jane = TestUtils.buildAgent('Jane Doe', ['sip.local'], '1002')

    const ref1 = ds.insert(john).result
    const ref2 = ds.insert(jane).result

    const l = ds.withCollection('agents')
        .find("'sip.local' in @.spec.domains").result

    assertTrue(l.length == 2)

    // NOTE: The space will not work in the console because is considered another parameter
    const response = agentsApi.getAgents("@.spec.credentials.username=='1001' || @.spec.credentials.username=='1002'")

    assertTrue(response.status == Status.OK)
    assertTrue(response.result.length == 2)

    // Cleanup
    ds.withCollection('agents').remove(ref1)
    ds.withCollection('agents').remove(ref2)
}

// This also validates the other resources
testGroup.get_agent = function () {
    const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
    agent.metadata.ref = 'ag3f77f6'
    const ref = ds.insert(agent).result
    const response = agentsApi.getAgent('ag3f77f6')
    assertTrue(response.status == Status.OK)
    assertTrue(response.result.kind == 'Agent')
    // Cleanup
    ds.withCollection('agents').remove(ref)
}
