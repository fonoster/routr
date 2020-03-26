/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Agents API on Redis Data Source"
 */
const RedisDataSource = require('@routr/data_api/redis_datasource')
const assert = require('assert')
const DomainsAPI = require('@routr/data_api/domains_api')
const AgentsAPI = require('@routr/data_api/agents_api')
const {
  UNFULFILLED_DEPENDENCY_RESPONSE,
  FOUND_DEPENDENT_OBJECTS_RESPONSE,
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
const domainsApi = new DomainsAPI(ds)
const domainRef = 'dm001'

describe('Agents API(on Redis)', () => {
  beforeEach(() => {
    ds.flushAll()
    agentsApi.cleanCache()
  })

  it('Create agent', done => {
    // Test missing dependency
    const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
    let response = agentsApi.createFromJSON(agent)
    assert.equal(response.status, Status.CONFLICT)
    assert.equal(response.message, UNFULFILLED_DEPENDENCY_RESPONSE.message)

    // Add dependecy resource
    const domain = TestUtils.buildDomain(
      'Local Domain',
      'sip.local',
      void 0,
      domainRef
    )
    ds.withCollection('domains').insert(domain)

    // Test entity missing required fields
    delete agent.metadata.name
    response = agentsApi.createFromJSON(agent)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Bad kind
    agent.metadata.name = 'John doe'
    agent.kind = 'Agentx'
    response = agentsApi.createFromJSON(agent)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Test for good Agent resource
    agent.kind = 'Agent'
    response = agentsApi.createFromJSON(agent)
    assert.equal(response.status, Status.CREATED)

    // Test uniqueness
    response = agentsApi.createFromJSON(agent)
    assert.equal(response.status, Status.CONFLICT)
    done()
  })

  it('Update agent', done => {
    // Add dependecy resource
    const domain = TestUtils.buildDomain(
      'Local Domain',
      'sip.local',
      void 0,
      domainRef
    )
    ds.withCollection('domains').insert(domain)

    // Test entity missing required fields
    const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
    agentsApi.createFromJSON(agent)
    delete agent.kind
    response = agentsApi.updateFromJSON(agent)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Bad kind
    agent.kind = 'Agentx'
    response = agentsApi.updateFromJSON(agent)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Bad reference
    const ref = agent.metadata.ref
    agent.kind = 'Agent'
    agent.metadata.ref = 'abc'
    response = agentsApi.updateFromJSON(agent)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Test for good resource
    agent.metadata.ref = ref
    delete agent.spec.credentials.secret
    response = agentsApi.updateFromJSON(agent)
    assert.equal(response.status, Status.OK)
    done()
  })

  it('Delete domains and agents', done => {
    // Add dependecy resource
    const domain = TestUtils.buildDomain(
      'Local Domain',
      'sip.local',
      void 0,
      domainRef
    )
    ds.withCollection('domains').insert(domain)

    // Test entity missing required fields
    const agent = TestUtils.buildAgent('John Doe', ['sip.local'], '1001')
    agentsApi.createFromJSON(agent)
    let response = domainsApi.deleteDomain(domainRef)
    assert.equal(response.status, FOUND_DEPENDENT_OBJECTS_RESPONSE.status)

    // Good run
    agentsApi.deleteAgent(agent.metadata.ref)
    response = domainsApi.deleteDomain(domainRef)
    assert.equal(response.status, Status.OK)

    done()
  })
})
