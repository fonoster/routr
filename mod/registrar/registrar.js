/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const AuthHelper = require('@routr/utils/auth_helper')
const { Status } = require('@routr/core/status')
const RegistrarUtils = require('@routr/registrar/utils')

const DSSelector = require('@routr/data_api/ds_selector')
const AgentsAPI = require('@routr/data_api/agents_api')
const PeersAPI = require('@routr/data_api/peers_api')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const AuthorizationHeader = Java.type('javax.sip.header.AuthorizationHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))

class Registrar {
  constructor () {
    this.peersAPI = new PeersAPI(DSSelector.getDS())
    this.agentsAPI = new AgentsAPI(DSSelector.getDS())
  }

  register (r) {
    // Prevents any chances of overwriting the original object
    const request = r.clone()
    let user

    if (this.isAuthorized(request)) {
      // Todo: Avoid making this second trip to the API
      user = this.getUserFromAPI(request)
    } else {
      return false
    }

    const aors = RegistrarUtils.generateAors(request, user)
    try {
      this.addEndpoints(aors, request, user)
      return true
    } catch (e) {
      // TODO: It might be usefull to send a response to inform client of error
    }
    return false
  }

  addEndpoints (aors, request, user) {
    aors.forEach(addressOfRecord => {
      const aorObj = addressOfRecord.clone()
      aorObj.removeParameter('synth')
      postal.publish({
        channel: 'locator',
        topic: 'endpoint.add',
        data: {
          addressOfRecord: aorObj.toString(),
          route: RegistrarUtils.buildRoute(addressOfRecord, request, user)
        }
      })
    })
  }

  getUserFromAPI (request) {
    const host = request
      .getHeader(FromHeader.NAME)
      .getAddress()
      .getURI()
      .getHost()
    const username = request.getHeader(AuthorizationHeader.NAME).getUsername()
    let response = this.agentsAPI.getAgent(host, username)

    if (response.status === Status.OK) {
      return response.data
    } else {
      response = this.peersAPI.getPeerByUsername(username)

      if (response.status === Status.OK) {
        return response.data
      }
    }

    LOG.debug(
      `registrar.Registrar.getUserFromAPI [Can't authenticate user => ${username}]`
    )

    return null
  }

  isAuthorized (request) {
    const authHeader = request.getHeader(AuthorizationHeader.NAME)

    if (authHeader === null) {
      return false
    }

    const user = this.getUserFromAPI(request)

    if (user === null) {
      return false
    }

    const aHeaderJson = RegistrarUtils.buildAuthHeader(user, authHeader)
    return AuthHelper.calcFromHeader(aHeaderJson).equals(
      authHeader.getResponse()
    )
  }
}

module.exports = Registrar
