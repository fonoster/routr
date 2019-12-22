/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Peers API on Redis Data Source"
 */
const RedisDataSource = require('@routr/data_api/redis_datasource')
const PeersAPI = require('@routr/data_api/peers_api')
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
const peersApi = new PeersAPI(ds)

describe('Peers API(on Redis)', () => {

    beforeEach(() => {
        ds.flushAll()
        peersApi.cleanCache()
    })

    it('Create peer', done => {
        // Test entity missing required fields
        const peer = TestUtils.buildEndpoint('Peer', 'Asterisk', 'ast', 'ast')
        delete peer.metadata.name
        let response = peersApi.createFromJSON(peer)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad kind
        peer.metadata.name = 'Freeswitch'
        peer.kind = 'Peerx'
        response = peersApi.createFromJSON(peer)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Test for good resource
        peer.kind = 'Peer'
        response = peersApi.createFromJSON(peer)
        assert.equal(response.status, Status.CREATED)

        // Test uniqueness
        response = peersApi.createFromJSON(peer)
        assert.equal(response.status, Status.CONFLICT)
        done()
    })

    it('Update peer', done => {
        // Test entity missing required fields
        const peer = TestUtils.buildEndpoint('Peer', 'Asterisk', 'ast', 'ast')
        peersApi.createFromJSON(peer)
        delete peer.kind
        response = peersApi.updateFromJSON(peer)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad kind
        peer.kind = 'Peerk'
        response = peersApi.updateFromJSON(peer)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Bad reference
        const ref = peer.metadata.ref
        peer.kind = 'Peer'
        peer.metadata.ref = 'abc'
        response = peersApi.updateFromJSON(peer)
        assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

        // Test for good resource
        peer.metadata.ref = ref
        delete peer.spec.credentials.secret
        response = peersApi.updateFromJSON(peer)
        assert.equal(response.status, Status.OK)
        done()
    })
})
