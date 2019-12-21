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
    UNFULFILLED_DEPENDENCY_RESPONSE,
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
const domainRef = 'dm001'
const mockDomain = {
    apiVersion: 'v1beta1',
    kind: 'Domain',
    metadata: {
      name: 'Local Domain',
      ref: domainRef
    },
    spec: {
      context: {
        domainUri: 'sip.local'
      }
    }
}

describe('Agents API(on Redis)', () => {

    after(() => ds.withCollection('domains').remove(domainRef))

    it('Create agent', done => {
        // Test missing dependency
        const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '5001')
        let response = agentsApi.createFromJSON(agent)
        assert.equal(response.status, Status.CONFLICT)
        assert.equal(response.message, UNFULFILLED_DEPENDENCY_RESPONSE.message)

        // Add dependecy resource
        ds.withCollection('domains').insert(mockDomain)

        // Test entity missing required fields
        delete agent.metadata.name
        response = agentsApi.createFromJSON(agent)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad kind
        agent.metadata.name = 'John doe'
        agent.kind = 'Agentk'
        response = agentsApi.createFromJSON(agent)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Test for good Agent resource
        agent.kind = 'Agent'
        response = agentsApi.createFromJSON(agent)
        assert.equal(response.status, Status.CREATED)

        // Test uniqueness
        response = agentsApi.createFromJSON(agent)
        assert.equal(response.status, Status.CONFLICT)

        // Cleanup
        ds.withCollection('agents').remove(agent.metadata.ref)
        done()
    })

    it('Update agent', done => {
        // Add dependecy resource
        ds.withCollection('domains').insert(mockDomain)

        // Test entity missing required fields
        const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '5001')
        agentsApi.createFromJSON(agent)
        agent.kind = 'Gateway'
        response = agentsApi.updateFromJSON(agent)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad kind
        agent.kind = 'Agentk'
        response = agentsApi.updateFromJSON(agent)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad reference
        const ref = agent.metadata.ref
        agent.kind = 'Agent'
        agent.metadata.ref = 'abc'
        response = agentsApi.updateFromJSON(agent)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Test for good Agent resource
        agent.metadata.ref = ref
        response = agentsApi.updateFromJSON(agent)
        assert.equal(response.status, Status.OK)

        // Cleanup
        ds.withCollection('agents').remove(ref)
        done()
    })
})
