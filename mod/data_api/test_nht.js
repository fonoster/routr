/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "NHT"
 */
const assert = require('assert')
const NHTServer = Java.type('io.routr.nht.NHTServer')
const NHTClient = Java.type('io.routr.nht.NHTClient')
const HashMap = Java.type('java.util.HashMap')

describe('Network Hashtable', () => {
    let nht
    const hasmap = new HashMap()

    before(() => {
        nhtServer = new NHTServer("vm://routr")
        nhtServer.start()
        nht = new NHTClient("vm://routr")
    })

    it('Adding new (key,value) pair', function(done) {
        assert.equal(nht.put('test', 'test'), null)
        done()
    })

    it('Listing values in the hastable', function(done) {
        nht.put('test', 'test')
        assert.ok(nht.list().length > 0)
        done()
    })

    // Be aware that in the current implemetation the object you send might not be the same you get
    // because of the serialization process.
    it('Getting value from table', function(done) {
        const body = { test: 'test'}
        nht.put('test', body)
        assert.equal(body.test, nht.get('test').get('test'))
        done()
    })

    it('Removing key', function(done) {
        nht.put('test', 'test')
        assert.equal(nht.remove('test'), 'test')
        done()
    })

    it.skip('Adding thousands of values normal hashmap', function(done) {
        for (let i = 0; i < 10000; i++) {
            const value = 'v' + i
            hasmap.put(value, value)
        }
        done()
    })

    it.skip('Adding thousands of values', function(done) {
        this.timeout(4000);
        for (let i = 0; i < 10000; i++) {
            const value = 'v' + i
            nht.put(value, value)
        }
        done()
    })
})
