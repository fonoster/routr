/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registrar Module"
 */
const chai = require('chai')
const expect = chai.expect
const { createRequest } = require('@routr/utils/test_util')
const { getExpires } = require('@routr/core/processor/processor_utils')

describe('@routr/registrar', () => {
  it('get expires', () => {
    const request1 = createRequest('1001@sip.local', '1002@sip.local')
    const request2 = createRequest('1001@sip.local', '1002@sip.local', true)
    expect(getExpires(request1)).to.equal(3600)
    expect(getExpires(request2)).to.equal(3601)
  })
})
