/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const AuthHelper = require('@routr/utils/auth_helper')
const { Status } = require('@routr/core/status')
const isEmpty = require('@routr/utils/obj_util')
const getConfig = require('@routr/core/config_util')
const RegistrarUtils = require('@routr/registrar/utils')

const DSSelector = require('@routr/data_api/ds_selector')
const AgentsAPI = require('@routr/data_api/agents_api')
const PeersAPI = require('@routr/data_api/peers_api')
const DomainsAPI = require('@routr/data_api/domains_api')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const ExpiresHeader = Java.type('javax.sip.header.ExpiresHeader')
const AuthorizationHeader = Java.type('javax.sip.header.AuthorizationHeader')
const SipFactory = Java.type('javax.sip.SipFactory')
const Unirest = Java.type('com.mashape.unirest.http.Unirest')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const addressFactory = SipFactory.getInstance().createAddressFactory()

const LOG = LogManager.getLogger()
const getHost = r =>
  r
    .getHeader(FromHeader.NAME)
    .getAddress()
    .getURI()
    .getHost()
const getUsername = r => r.getHeader(AuthorizationHeader.NAME).getUsername()

class Registrar {
  constructor () {
    this.peersAPI = new PeersAPI(DSSelector.getDS())
    this.agentsAPI = new AgentsAPI(DSSelector.getDS())
    this.domainsAPI = new DomainsAPI(DSSelector.getDS())
  }

  register (r) {
    // Prevents any chances of overwriting the original object
    const request = r.clone()
    let user

    if (this.isAuthorized(request)) {
      // Todo: Avoid making this second trip to the API
      user = this.getUserFromAPI(request)

      if (user === null) {
        user = {
          kind: 'Agent',
          spec: {
            domains: [getHost(request)],
            credentials: {
              username: getUsername(request)
            }
          }
        }
      }
    } else {
      return false
    }

    const aors = RegistrarUtils.generateAors(request, user)
    this.addEndpoints(aors, request, user)
    return true
  }

  addEndpoints (aors, request, user) {
    aors.forEach(addressOfRecord => {
      postal.publish({
        channel: 'locator',
        topic: 'endpoint.add',
        data: {
          addressOfRecord: addressOfRecord,
          route: RegistrarUtils.buildRoute(addressOfRecord, request, user)
        }
      })
    })
  }

  getUserFromAPI (request) {
    const username = getUsername(request)
    let response = this.agentsAPI.getAgent(getHost(request), username)

    if (response.status === Status.OK) {
      return response.data
    } else {
      response = this.peersAPI.getPeerByUsername(username)

      if (response.status === Status.OK) {
        return response.data
      }
    }

    LOG.debug(
      `registrar.Registrar.getUserFromAPI [Can't find local credentials for user => ${username}]`
    )

    return null
  }

  isAuthorized (request) {
    const authHeader = request.getHeader(AuthorizationHeader.NAME)

    if (authHeader === null) {
      return false
    }

    return (
      this.hasLocalCred(request, authHeader) ||
      this.hasRemoteCred(request, authHeader)
    )
  }

  hasLocalCred (request, authHeader) {
    const user = this.getUserFromAPI(request)

    if (user === null) return false

    const aHeaderJson = RegistrarUtils.buildAuthHeader(user, authHeader)
    return AuthHelper.calcFromHeader(aHeaderJson).equals(
      authHeader.getResponse()
    )
  }

  hasRemoteCred (request, authHeader) {
    try {
      const response = this.domainsAPI.getDomainByUri(getHost(request))
      const domain = response.data
      if (domain.spec.ex_restRegistration) {
        const username = getUsername(request)
        const authReq = RegistrarUtils.buildAuthHeader(
          {
            spec: { credentials: { username } }
          },
          authHeader
        )

        console.log(
          `registrar.Registrar.hasValidRemoteCred [authReq => ${JSON.stringify(
            authReq
          )}]`
        )

        const r = Unirest.post(domain.spec.ex_restRegistration.endpoint)
          .header('Content-Type', 'application/json')
          .routeParam('id', username)
          .body('' + JSON.stringify(authReq))
          .asString()

        console.log(
          `registrar.Registrar.hasValidRemoteCred [authRes => ${r.getBody()}]`
        )

        console.log('r.getStatus() === Status.OK ', r.getStatus() === Status.OK)
        return r.getStatus() === Status.OK
      }
    } catch (e) {
      LOG.warn(e)
    }
  }
}

module.exports = Registrar
