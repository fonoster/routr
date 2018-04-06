/**
 * @author Pedro Sanders
 * @since v1
 */
import AuthHelper from 'utils/auth_helper'
import { Status } from 'core/status'
import isEmpty from 'utils/obj_util'

const ViaHeader = Packages.javax.sip.header.ViaHeader
const ContactHeader = Packages.javax.sip.header.ContactHeader
const FromHeader = Packages.javax.sip.header.FromHeader
const ExpiresHeader = Packages.javax.sip.header.ExpiresHeader
const AuthorizationHeader = Packages.javax.sip.header.AuthorizationHeader
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const SipFactory = Packages.javax.sip.SipFactory

export default class Registrar {

    constructor(locator, dataAPIs) {
        this.locator = locator
        this.peersAPI = dataAPIs.PeersAPI
        this.agentsAPI = dataAPIs.AgentsAPI
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
    }

    register(r) {
        // For some reason this references the parent object
        // to avoid I just clone it!
        print ('DBG001')
        const request = r.clone()
        print ('DBG002')
        const authHeader = request.getHeader(AuthorizationHeader.NAME)
        const fromHeader = request.getHeader(FromHeader.NAME)
        const fromURI = fromHeader.getAddress().getURI()
        const host = fromURI.getHost()
        print ('DBG003')
        // Get user from db or file
        const user = this.getUser(authHeader.getUsername(), host)
        const aHeaderJson = Registrar.buildHeader(user, authHeader)
        print ('DBG004')
        if (new AuthHelper()
            .calcFromHeader(aHeaderJson)
                .equals(authHeader.getResponse())) {
         print ('DBG0015')
            this.addEndpoint(user, host, request)
                    print ('DBG005')
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

    getNonceCount(d) {
        const h = Packages.java.lang.Integer.toHexString(d)
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
        const route = Registrar.buildRoute(user, viaHeader, contactURI, expires)
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
                throw 'Could not find user or peer \'' + username + '\''
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
            contactURI: getUpdatedContactURI(user, viaHeader, contactURI),
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
        } else {
            if(!!viaHeader.getReceived()) {
                contactURI.setHost(viaHeader.getReceived())
            }

            if(!!viaHeader.getParameter('rport')) {
                contactURI.setPort(viaHeader.getParameter('rport'))
            }
        }
        return contactURI
    }

    static buildHeader(user, authHeader) {
        return {
            username: user.spec.credentials.username,
            secret: user.spec.credentials.secret,
            realm: authHeader.getRealm(),
            nonce: authHeader.getNonce(),
            // For some weird reason the interface value is an int while the value original value is a string
            nc: this.getNonceCount(authHeader.getNonceCount()),
            cnonce: authHeader.getCNonce(),
            uri: authHeader.getURI().toString(),
            method: 'REGISTER',
            qop: authHeader.getQop()
        }
    }

    static getExpires(request) {
        const contactHeader = request.getHeader(ContactHeader.NAME)
        // Simplify
        if (request.getHeader(ExpiresHeader.NAME)) {
            expires = request.getHeader(ExpiresHeader.NAME).getExpires()
        } else {
            expires = contactHeader.getExpires()
        }
        return expires
    }
}
