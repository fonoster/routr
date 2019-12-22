/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Numbers API on Redis Data Source"
 */
const RedisDataSource = require('@routr/data_api/redis_datasource')
const NumbersAPI = require('@routr/data_api/numbers_api')
const TestUtils = require('@routr/data_api/test_utils')
const DSUtils = require('@routr/data_api/utils')
const ObjectId = Java.type('org.bson.types.ObjectId')
const assert = require('assert')
const config = require('@routr/core/config_util')()
const {
    UNFULFILLED_DEPENDENCY_RESPONSE,
    Status
} = require('@routr/core/status')

// Forces RedisDataSource to use its own default parameters
delete config.spec.dataSource.parameters
const ds = new RedisDataSource(config)
const numbersApi = new NumbersAPI(ds)
const gwRef = 'gw001'

describe('Numbers API(on Redis)', () => {

    beforeEach(() => {
        ds.flushAll()
        numbersApi.cleanCache()
    })

    it('Create number', done => {
        // Test missing dependency
        const number = TestUtils.buildNumber(gwRef)
        let response = numbersApi.createFromJSON(number)
        assert.equal(response.status, Status.CONFLICT)
        assert.equal(response.message, UNFULFILLED_DEPENDENCY_RESPONSE.message)

        // Add dependecy resource
        const gateway = TestUtils.buildGateway('Service Provider', 'sp', gwRef)
        ds.withCollection('gateways').insert(gateway)

        // Test entity missing required fields
        delete number.metadata.gwRef
        response = numbersApi.createFromJSON(number)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad kind
        number.metadata.gwRef = gwRef
        number.kind = 'Numberx'
        response = numbersApi.createFromJSON(number)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Test for good Number resource
        number.kind = 'Number'
        response = numbersApi.createFromJSON(number)
        assert.equal(response.status, Status.CREATED)

        // Test uniqueness
        response = numbersApi.createFromJSON(number)
        assert.equal(response.status, Status.CONFLICT)
        done()
    })

    it('Update number', done => {
        // Add dependecy resource
        const gateway = TestUtils.buildGateway('Service Provider', 'sp', gwRef)
        ds.withCollection('gateways').insert(gateway)

        // Test entity missing required fields
        const number = TestUtils.buildNumber(gwRef)
        numbersApi.createFromJSON(number)
        delete number.kind
        response = numbersApi.updateFromJSON(number)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad kind
        number.kind = 'Numberx'
        response = numbersApi.updateFromJSON(number)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad reference
        const ref = number.metadata.ref
        number.kind = 'Number'
        number.metadata.ref = 'abc'
        response = numbersApi.updateFromJSON(number)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Test for good resource
        number.metadata.ref = ref
        response = numbersApi.updateFromJSON(number)
        assert.equal(response.status, Status.OK)
        done()
    })
})
