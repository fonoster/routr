/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const AuthHelper = require('@routr/utils/auth_helper')
const { Status } = require('@routr/core/status')
const isEmpty = require('@routr/utils/obj_util')
const getConfig = require('@routr/core/config_util')

const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const ExpiresHeader = Java.type('javax.sip.header.ExpiresHeader')
const AuthorizationHeader = Java.type('javax.sip.header.AuthorizationHeader')
const SipFactory = Java.type('javax.sip.SipFactory')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const addressFactory = SipFactory.getInstance().createAddressFactory()

const LOG = LogManager.getLogger()

class Registrar {

    constructor(dataAPIs) {
        this.peersAPI = dataAPIs.PeersAPI
        this.agentsAPI = dataAPIs.AgentsAPI
    }

    register(r) {
        // Prevents any chances of overwriting the original object
        const request = r.clone()
        const isGuest = Registrar.isGuest(request)
        let user

        // Warning: This is just for testing purposes
        if(isGuest && this.isAllowGuest()) {
            user =  Registrar.getGuessUser(request)
        } else if(this.isAuthorized(request)) {
            // Todo: Avoid making this second trip to the API
            user = this.getUserFromAPI(request)
        } else {
            return false
        }

        const aors = Registrar.generateAors(request, user, isGuest)
        this.addEndpoints(aors, Registrar.buildRoute(request, user))
        return true
    }

    addEndpoints(aors, route) {
        aors.forEach(addressOfRecord => {
            postal.publish({
                channel: "locator",
                topic: "endpoint.add",
                data: {
                    addressOfRecord: addressOfRecord,
                    route: route
                }
            })
        })
    }

    getUserFromAPI(request) {
        const host = Registrar.getFromHost(request)
        const username = request.getHeader(AuthorizationHeader.NAME).getUsername()
        let response = this.agentsAPI.getAgent(host, username)

        if (response.status === Status.OK) {
            return response.result
        } else {
            response = this.peersAPI.getPeerByUsername(username)

            if (response.status === Status.OK ) {
                return response.result
            }
        }
        return
    }

    isAuthorized(request) {
        const authHeader = request.getHeader(AuthorizationHeader.NAME)

        if (authHeader === null) {
            return false
        }

        const user = this.getUserFromAPI(request)

        if (user === null) {
            return false
        }

        const aHeaderJson = Registrar.buildHeader(user, authHeader)
        return AuthHelper.calcFromHeader(aHeaderJson).equals(authHeader.getResponse())
    }

    isAllowGuest() {
      return getConfig().spec.allowGuest === true
    }

    static generateAors(request, user, isGuest) {
        const aors = []

        if (isGuest || user.kind.equalsIgnoreCase('peer')) {
            const host = Registrar.getFromHost(request)
            const peerHost = isEmpty(user.spec.device) ?  host : user.spec.device
            aors.push(addressFactory.createSipURI(user.spec.credentials.username, peerHost))
        } else {
            user.spec.domains.forEach(domain => {
                const addressOfRecord = addressFactory.createSipURI(user.spec.credentials.username, domain)
                addressOfRecord.setSecure(contactURI.isSecure())
                aors.push(addressOfRecord)
            })
        }
        return aors
    }

    static isGuest(request) {
      return Registrar.getFromHost(request).equalsIgnoreCase('guest')
    }

    static getGuessUser(request) {
        const fromHeader = request.getHeader(FromHeader.NAME)
        return {
            kind: 'User',
            spec: {
                credentials: {
                    username: fromHeader.getAddress().getURI().getUser()
                }
            }
        }
    }

    static getFromHost(request) {
      return request.getHeader(FromHeader.NAME)
          .getAddress().getURI().getHost()
    }

    static buildRoute(request, user) {
        const viaHeader = request.getHeader(ViaHeader.NAME)
        return {
            isLinkAOR: false,
            thruGw: false,
            sentByAddress: viaHeader.getHost(),
            sentByPort: (viaHeader.getPort() === -1 ? 5060 : viaHeader.getPort()),
            received: viaHeader.getReceived(),
            rport: viaHeader.getParameter('rport'),
            contactURI: Registrar.getUpdatedContactURI(request, user),
            registeredOn: Date.now(),
            expires: Registrar.getExpires(request),
            nat: Registrar.isNat(request)
        }
    }

    static isNat(request) {
       const viaHeader = request.getHeader(ViaHeader.NAME)
       return (viaHeader.getHost() + viaHeader.getPort()) !==
          (viaHeader.getReceived() + viaHeader.getParameter('rport'))
    }

    static getUpdatedContactURI(request, user) {
        const contactHeader = request.getHeader(ContactHeader.NAME)
        const contactURI = contactHeader.getAddress().getURI()
        const viaHeader = request.getHeader(ViaHeader.NAME)

        if (user.kind.equalsIgnoreCase('peer') && !isEmpty(user.spec.contactAddr)) {
            if (user.spec.contactAddr.contains(":")) {
                contactURI.setHost(user.spec.contactAddr.split(":")[0])
                contactURI.setPort(user.spec.contactAddr.split(":")[1])
            } else {
                contactURI.setHost(user.spec.contactAddr)
            }
        } else if(Registrar.useInternalInterface(request)) {
            if(viaHeader.getReceived() !== null) {
                contactURI.setHost(viaHeader.getReceived())
            }

            if(viaHeader.getParameter('rport') !== null) {
                contactURI.setPort(viaHeader.getParameter('rport'))
            }
        }
        return contactURI
    }

    static useInternalInterface(request) {
        const viaHeader = request.getHeader(ViaHeader.NAME)
        if (getConfig().spec.registrarIntf.equalsIgnoreCase('Internal')) {
            return true
        }
        return viaHeader.getTransport().equalsIgnoreCase('udp')? true : false
    }

    static buildHeader(user, authHeader) {
        return {
            username: user.spec.credentials.username,
            secret: user.spec.credentials.secret,
            realm: authHeader.getRealm(),
            nonce: authHeader.getNonce(),
            // For some weird reason the interface value is an int while the value original value is a string
            nc: Registrar.getNonceCount(authHeader.getNonceCount()),
            cnonce: authHeader.getCNonce(),
            uri: authHeader.getURI().toString(),
            method: 'REGISTER',
            qop: authHeader.getQop()
        }
    }

    static getExpires(request) {
        const contactHeader = request.getHeader(ContactHeader.NAME)
        return request.getHeader(ExpiresHeader.NAME)? request.getHeader(ExpiresHeader.NAME).getExpires() :
            contactHeader.getExpires()
    }

    static getNonceCount(d) {
        const h = Java.type('java.lang.Integer').toHexString(d)
        const cSize = 8 - h.toString().length
        let nc = ''
        let cnt = 0

        while (cSize > cnt) {
            nc += '0'
            cnt++
        }

        return nc + h
    }
}

module.exports = Registrar
