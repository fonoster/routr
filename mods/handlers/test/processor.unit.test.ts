import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import chaiAsPromised from 'chai-as-promised'
import EdgePort from '../src/edgeport'

const expect = chai.expect
chai.use(sinonChai)
chai.use(chaiAsPromised)
const sandbox = sinon.createSandbox()

describe('Edge Port Service', () => {

  it('need testing', done => {
    // Needs testing
    const ep = new EdgePort()
    ep.test()
    done()
  })

})

