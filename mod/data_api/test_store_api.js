/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for Store API
 */
const StoreAPI = require('@routr/data_api/store_api')
const RedisStore = require('@routr/data_api/redis_store')
const FilesStore = require('@routr/data_api/files_store')
const assert = require('assert')

describe('Store API', () => {
    let storeDriverImpls = []

    before(() => {
        storeDriverImpls.push(new RedisStore())
        storeDriverImpls.push(new FilesStore())
    })

    it('Basic store api functions', function(done) {
        storeDriverImpls.forEach(driver => {
            const store = new StoreAPI(driver)
            store.withCollection('c1').put('test', 'test')
            assert.equal(store.withCollection('c1').get('test'), 'test')
            assert.equal(store.withCollection('c1').values().length, 1)
            store.remove('test')
            assert.equal(store.withCollection('c1').get('test'), null)
        })

        done()
    })

    it(`Speed test for "put" function`, function(done) {
        let count = 0
        storeDriverImpls.forEach(driver => {
            const store = new StoreAPI(driver)
            console.time(`\tDriver #${count}`)

            for (var i = 1; i <= 10000; i++) {
                const kv = 'test#' + i
                store.withCollection('c2').put(kv, kv)
            }
            // Now calculate and output the difference
            console.timeEnd(`\tDriver #${count++}`)
        })

        done()
    })

})
