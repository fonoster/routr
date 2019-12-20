/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Redis Data Source"
 */
const RedisDataSource = require('@routr/data_api/redis_datasource')
const assert = require('assert')
const AgentsAPI = require('@routr/data_api/agents_api')
const {
    Status
} = require('@routr/core/status')
const TestUtils = require('@routr/data_api/test_utils')
const DSUtils = require('@routr/data_api/utils')
const config = require('@routr/core/config_util')()
const ObjectId = Java.type('org.bson.types.ObjectId')

// Forces RedisDataSource to use its own default parameters
delete config.spec.dataSource.parameters
const ds = new RedisDataSource(config)
const agentsApi = new AgentsAPI(ds)

describe('Redis Data Source', () => {
    it('Basic operations', function(done) {
        const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
        const initSize = ds.withCollection('agents').find().data.length
        const response = ds.insert(agent)
        let endSize = ds.withCollection('agents').find().data.length

        assert.ok(ObjectId.isValid(response.data))
        assert.equal(endSize, initSize + 1)
        assert.equal(agent.metadata.name, 'John Doe')

        ds.withCollection('agents').remove(response.data)
        endSize = ds.withCollection('agents').find().data.length
        assert.equal(initSize, endSize)
        done()
    })

    it('Get collections', function(done) {
        const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
        const initSize = ds.withCollection('agents').find().data.length
        const ref = ds.insert(agent).data

        // Existing Agent
        let response = ds.withCollection('agents').find("@.spec.credentials.username==1001")
        assert.equal(Status.OK, response.status)

        // Non-Existing Agent
        response = ds.withCollection('agents').find("@.spec.credentials.username=='peter'")
        assert.equal(0, response.data.length)

        // Invalid filter
        response = ds.withCollection('agents').find("@.spec.credentials.username==mike'")
        assert.equal(Status.BAD_REQUEST, response.status)

        ds.withCollection('agents').remove(ref)
        const endSize = ds.withCollection('agents').find().data.length
        assert.equal(initSize, endSize)
        done()
    })

    it('Get agents', function(done) {
        const john = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
        const jane = TestUtils.buildAgent('Jane Doe', ['sip.local'], '1002')

        const oldCnt = ds.withCollection('agents')
            .find("'sip.local' in @.spec.domains").data.length

        const ref1 = ds.withCollection('agents').insert(john).data
        const ref2 = ds.withCollection('agents').insert(jane).data

        // NOTE: The space will not work in the console because is considered another parameter
        const response = agentsApi.getAgents("@.spec.credentials.username=='1001' || @.spec.credentials.username=='1002'")

        assert.equal(Status.OK, response.status)

        // Cleanup
        ds.withCollection('agents').remove(ref1)
        ds.withCollection('agents').remove(ref2)

        const newCnt = ds.withCollection('agents')
            .find("'sip.local' in @.spec.domains").data.length

        assert.equal(oldCnt, newCnt)

        done()
    })

    it('Get agent', function(done) {
        const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
        agent.metadata.ref = 'ag3f77f6'
        const ref = ds.insert(agent).data
        const response = agentsApi.getAgent('ag3f77f6')
        assert.equal(Status.OK, response.status)
        assert.equal('Agent', response.data.kind)
        // Cleanup
        ds.withCollection('agents').remove(ref)
        done()
    })

    it('Test removeWO', done => {
        // Test entity missing required fields
        const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '5001')
        const result = DSUtils.removeWO(agent)
        assert.equal(void(0), result.spec.credentials.secret)
        done()
    })
})
