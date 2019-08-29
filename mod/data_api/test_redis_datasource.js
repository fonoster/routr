/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Redis Data Source"
 */
const assert = require('assert')
const AgentsAPI = require('@routr/data_api/agents_api')
const {
    Status
} = require('@routr/core/status')
const TestUtils = require('@routr/data_api/test_utils')
const getConfig = require('@routr/core/config_util')
const ObjectId = Java.type('org.bson.types.ObjectId')
const testGroup = {
    name: "Redis Data Source",
    enabled: false
}
const config = getConfig()
// To force RedisDataSource to use its own default parameters...
delete config.spec.dataSource.parameters
const ds = null
const agentsApi = new AgentsAPI(ds)

describe('Redis Data Source', () => {
    it.skip('Basic operations', function(done) {
        const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
        const initSize = ds.withCollection('agents').find().result.length
        const response = ds.insert(agent)
        let endSize = ds.withCollection('agents').find().result.length

        assert.ok(ObjectId.isValid(response.result))
        assert.ok(endSize == (initSize + 1))
        assert.ok(agent.metadata.name.equals('John Doe'))

        ds.withCollection('agents').remove(response.result)
        endSize = ds.withCollection('agents').find().result.length
        assert.ok(initSize == endSize)
        done()
    })

    it.skip('Get collections', function(done) {
        const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
        const initSize = ds.withCollection('agents').find().result.length
        const ref = ds.insert(agent).result

        // Existing Agent
        let response = ds.withCollection('agents').find("@.spec.credentials.username==1001")
        assert.ok(response.status == Status.OK)

        // Non-Existing Agent
        response = ds.withCollection('agents').find("@.spec.credentials.username=='peter'")
        assert.ok(response.result.length == 0)

        // Invalid filter
        response = ds.withCollection('agents').find("@.spec.credentials.username==mike'")
        assert.ok(response.status == Status.BAD_REQUEST)

        ds.withCollection('agents').remove(ref)
        const endSize = ds.withCollection('agents').find().result.length
        assert.ok(initSize == endSize)
        done()
    })

    it.skip('Get agents', function(done) {
        const john = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
        const jane = TestUtils.buildAgent('Jane Doe', ['sip.local'], '1002')

        const ref1 = ds.insert(john).result
        const ref2 = ds.insert(jane).result

        const l = ds.withCollection('agents')
            .find("'sip.local' in @.spec.domains").result

        assert.ok(l.length == 2)

        // NOTE: The space will not work in the console because is considered another parameter
        const response = agentsApi.getAgents("@.spec.credentials.username=='1001' || @.spec.credentials.username=='1002'")

        assert.ok(response.status == Status.OK)
        assert.ok(response.result.length == 2)

        // Cleanup
        ds.withCollection('agents').remove(ref1)
        ds.withCollection('agents').remove(ref2)
        done()
    })

    it.skip('Get agent', function(done) {
        const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
        agent.metadata.ref = 'ag3f77f6'
        const ref = ds.insert(agent).result
        const response = agentsApi.getAgent('ag3f77f6')
        assert.ok(response.status == Status.OK)
        assert.ok(response.result.kind == 'Agent')
        // Cleanup
        ds.withCollection('agents').remove(ref)
        done()
    })
})
