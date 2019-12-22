/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Domains API on Redis Data Source"
 */
const RedisDataSource = require('@routr/data_api/redis_datasource')
const DomainsAPI = require('@routr/data_api/domains_api')
const TestUtils = require('@routr/data_api/test_utils')
const DSUtils = require('@routr/data_api/utils')
const ObjectId = Java.type('org.bson.types.ObjectId')
const {
    UNFULFILLED_DEPENDENCY_RESPONSE,
    Status
} = require('@routr/core/status')
const assert = require('assert')
const config = require('@routr/core/config_util')()

// Forces RedisDataSource to use its own default parameters
delete config.spec.dataSource.parameters
const ds = new RedisDataSource(config)
const domainsApi = new DomainsAPI(ds)
const gwRef = 'gw101'
const numberRef = 'dd101'

describe('Domains API(on Redis)', () => {

    beforeEach(() => ds.flushAll())

    it('Create domain', done => {
        // Test missing dependency
        const domain = TestUtils.buildDomain('SIP Local', 'sip.local', numberRef)
        let response = domainsApi.createFromJSON(domain)
        assert.equal(response.status, Status.CONFLICT)
        assert.equal(response.message, UNFULFILLED_DEPENDENCY_RESPONSE.message)

        // Add dependecy resource
        const gateway = TestUtils.buildGateway('GW1001', 'gw1001', gwRef)
        const number = TestUtils.buildNumber(gwRef, numberRef)
        ds.withCollection('gateways').insert(gateway)
        ds.withCollection('numbers').insert(number)

        // Test entity missing required fields
        delete domain.spec.context.domainUri
        response = domainsApi.createFromJSON(domain)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad kind
        domain.spec.context.domainUri = 'sip.local'
        domain.kind = 'Domainx'
        response = domainsApi.createFromJSON(domain)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Test for good resource
        domain.kind = 'Domain'
        response = domainsApi.createFromJSON(domain)
        assert.equal(response.status, Status.CREATED)

        // Test uniqueness
        response = domainsApi.createFromJSON(domain)
        assert.equal(response.status, Status.CONFLICT)

        // Cleanup
        domainsApi.deleteDomain(domain.metadata.ref)
        done()
    })

    it('Update domain', done => {
        // Add dependecy resource
        const gateway = TestUtils.buildGateway('GW1001', 'gw1001', gwRef)
        const number = TestUtils.buildNumber(gwRef, numberRef)
        ds.withCollection('gateways').insert(gateway)
        ds.withCollection('numbers').insert(number)

        // Test entity missing required fields
        const domain = TestUtils.buildDomain('SIP Local', 'sip.local', numberRef)
        let response = domainsApi.createFromJSON(domain)
        delete domain.kind
        response = domainsApi.updateFromJSON(domain)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad kind
        domain.kind = 'Domainx'
        response = domainsApi.updateFromJSON(domain)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad reference
        const ref = domain.metadata.ref
        domain.kind = 'Domain'
        domain.metadata.ref = 'abc'
        response = domainsApi.updateFromJSON(domain)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Test for good Agent resource
        domain.metadata.ref = ref
        response = domainsApi.updateFromJSON(domain)
        assert.equal(response.status, Status.OK)

        // Cleanup
        domainsApi.deleteDomain(ref)
        done()
    })
})
