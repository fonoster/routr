/**
 * @author Pedro Sanders
 * @since v1
 */
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

class Registrar {

    constructor(locator, dataAPIs) {
        this.locator = locator
        this.peersAPI = dataAPIs.PeersAPI
        this.agentsAPI = dataAPIs.AgentsAPI
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
    }

    register(r) {
        // For some reason this references the parent object
        // to avoid I just clone it!
        const request = r.clone()
        const authHeader = request.getHeader(AuthorizationHeader.NAME)
        const fromHeader = request.getHeader(FromHeader.NAME)
        const fromURI = fromHeader.getAddress().getURI()
        const host = fromURI.getHost()

        // Get user from db or file
        const user = this.getUser(authHeader.getUsername(), host)
        const aHeaderJson = Registrar.buildHeader(user, authHeader)

        if (new AuthHelper()
            .calcFromHeader(aHeaderJson)
                .equals(authHeader.getResponse())) {
            this.addEndpoint(user, host, request)
            return true
        }
        return false
    }

    hasDomain(user, domain) {
        if (user.spec.domains == null || user.spec.domains.length == 0) return false
        let result = false
        user.spec.domains.forEach(function(d) {
            if (domain === d) result=true
        })
        return result
    }

    static getNonceCount(d) {
        const h = Java.type('java.lang.Integer').toHexString(d)
        const cSize = 8 - h.toString().length()
        let nc = ''
        let cnt = 0

        while (cSize > cnt) {
            nc += '0'
            cnt++
        }

        return nc + h
    }

    addEndpoint(user, host, request) {
        const contactHeader = request.getHeader(ContactHeader.NAME)
        const contactURI = contactHeader.getAddress().getURI()
        const viaHeader = request.getHeader(ViaHeader.NAME)
        const route = Registrar.buildRoute(user, viaHeader, contactURI, Registrar.getExpires(request))
        let addressOfRecord

        if (user.kind.equalsIgnoreCase('peer')) {
            const peerHost = isEmpty(user.spec.device) ?  host : user.spec.device
            addressOfRecord = this.addressFactory.createSipURI(user.spec.credentials.username, peerHost)
            addressOfRecord.setSecure(contactURI.isSecure())
        } else {
            user.spec.domains.forEach(domain => {
                addressOfRecord = this.addressFactory.createSipURI(user.spec.credentials.username, domain)
                addressOfRecord.setSecure(contactURI.isSecure())
            })
        }

        this.locator.addEndpoint(addressOfRecord, route)
    }

    getUser(username, host) {
        let user
        // TODO: Consider placing all the peer entities in a cache, for less
        // calls to the datasource.
        let response = this.peersAPI.getPeerByUsername(username)

        if (response.status == Status.OK) {
            user = response.result
        } else {
            // Then lets check agents
            response = this.agentsAPI.getAgent(host, username)

            if (response.status == Status.OK ) {
                user = response.result
            }
        }

        if (user == null) {
            throw 'Could not find agent or peer \'' + username + '\''
        }

        return user
    }

    static buildRoute(user, viaHeader, contactURI, expires) {
        // Detect NAT
        const nat = (viaHeader.getHost() + viaHeader.getPort()) != (viaHeader.getReceived() + viaHeader.getParameter('rport'))
        return {
            isLinkAOR: false,
            thruGw: false,
            sentByAddress: viaHeader.getHost(),
            sentByPort: (viaHeader.getPort() == -1 ? 5060 : viaHeader.getPort()),
            received: viaHeader.getReceived(),
            rport: viaHeader.getParameter('rport'),
            contactURI: Registrar.getUpdatedContactURI(user, viaHeader, contactURI),
            registeredOn: Date.now(),
            expires: expires,
            nat: nat
        }
    }

    static getUpdatedContactURI(user, viaHeader, contactURI) {
        if (user.kind.equalsIgnoreCase('peer') && !isEmpty(user.spec.contactAddr)) {
            if (user.spec.contactAddr.contains(":")) {
                contactURI.setHost(user.spec.contactAddr.split(":")[0])
                contactURI.setPort(user.spec.contactAddr.split(":")[1])
            } else {
                contactURI.setHost(user.spec.contactAddr)
            }
        } else if(Registrar.useInternalInterface(viaHeader)) {
            if(viaHeader.getReceived() != null) {
                contactURI.setHost(viaHeader.getReceived())
            }

            if(viaHeader.getParameter('rport') != null) {
                contactURI.setPort(viaHeader.getParameter('rport'))
            }
        }
        return contactURI
    }

    static useInternalInterface(viaHeader) {
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
}

module.exports = Registrar
