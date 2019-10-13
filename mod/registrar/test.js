/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registrar Module"
 */
const assert = require('assert')
const {
    createRequest
} = require('@routr/utils/test_util')
const RegistrarUtils = require('@routr/registrar/utils')

describe('Registrar checks', () => {

    it('Get expires', function(done) {
        const request1 = createRequest('1001@sip.local', '1002@sip.local')
        const request2 = createRequest('1001@sip.local', '1002@sip.local', true)
        assert.equal(RegistrarUtils.getExpires(request1), 3600)
        assert.equal(RegistrarUtils.getExpires(request2), 3601)
        done()
    })
})
