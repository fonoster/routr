/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registrar Module"
 */
const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)
const expect = chai.expect
var sandbox = sinon.createSandbox()

describe('@routr/registrar', () => {
  afterEach(() => {
    sandbox.restore()
  })

  it.skip('authenticate request', () => {
    const Unirest = Java.type('com.mashape.unirest.http.Unirest')
    const response = Unirest.post(
      'http://localhost:3000/device/1001/authenticate'
    )
      .header('Content-Type', 'application/json')
      .body("{'a': 'a'}")
      .asString()
  })
})
