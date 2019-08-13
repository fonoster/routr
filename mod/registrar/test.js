/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registrar Module"
 */
const { createRequest } = require('@routr/utils/test_util')
const RegistrarUtils = require('@routr/registrar/utils')

const testGroup = { name: "Registrar Module" }

// Tests
testGroup.get_expires = function() {
    const request1 = createRequest('1001@sip.local', '1002@sip.local')
    const request2 = createRequest('1001@sip.local', '1002@sip.local', true)
    assertEquals(3600, RegistrarUtils.getExpires(request1))
    assertEquals(3601, RegistrarUtils.getExpires(request2))
}

module.exports.testGroup = testGroup
