/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Gateways API on Redis Data Source"
 */
const RedisDataSource = require('@routr/data_api/redis_datasource')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const TestUtils = require('@routr/data_api/test_utils')
const { Status } = require('@routr/core/status')
const assert = require('assert')
const config = require('@routr/core/config_util')()

// Forces RedisDataSource to use its own default parameters
delete config.spec.dataSource.parameters
const ds = new RedisDataSource(config)
const gatewaysApi = new GatewaysAPI(ds)

describe('Gateways API(on Redis)', () => {
  beforeEach(() => {
    ds.flushAll()
    gatewaysApi.cleanCache()
  })

  it('Create gateway', done => {
    // Test entity missing required fields
    const gateway = TestUtils.buildGateway('Service Provider', 'sp')
    delete gateway.metadata.name
    let response = gatewaysApi.createFromJSON(gateway)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Bad kind
    gateway.metadata.name = 'Gateway'
    gateway.kind = 'Gatewayx'
    response = gatewaysApi.createFromJSON(gateway)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Test for good resource
    gateway.kind = 'Gateway'
    response = gatewaysApi.createFromJSON(gateway)
    assert.equal(response.status, Status.CREATED)

    // Test uniqueness
    response = gatewaysApi.createFromJSON(gateway)
    assert.equal(response.status, Status.CONFLICT)
    done()
  })

  it('Update gateway', done => {
    // Test entity missing required fields
    const gateway = TestUtils.buildGateway('Service Provider', 'sp')
    gatewaysApi.createFromJSON(gateway)
    delete gateway.kind
    response = gatewaysApi.updateFromJSON(gateway)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Bad kind
    gateway.kind = 'Gatewayx'
    response = gatewaysApi.updateFromJSON(gateway)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Bad reference
    const ref = gateway.metadata.ref
    gateway.kind = 'Gateway'
    gateway.metadata.ref = 'abc'
    response = gatewaysApi.updateFromJSON(gateway)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Test for good resource
    gateway.metadata.ref = ref
    delete gateway.spec.credentials.secret
    response = gatewaysApi.updateFromJSON(gateway)
    assert.equal(response.status, Status.OK)
    done()
  })
})
