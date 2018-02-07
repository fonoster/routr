/**
 * @author Pedro Sanders
 * @since v1
 */
import AuthHelper from 'utils/auth_helper'
import { Status } from 'resources/status'
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
        const request = r.clone()
        const viaHeader = request.getHeader(ViaHeader.NAME)
        const authHeader = request.getHeader(AuthorizationHeader.NAME)
        const contactHeader = request.getHeader(ContactHeader.NAME)
        const contactURI = contactHeader.getAddress().getURI()
        const fromHeader = request.getHeader(FromHeader.NAME)
        const fromURI = fromHeader.getAddress().getURI()
        const host = fromURI.getHost()
        let expires

        if (request.getHeader(ExpiresHeader.NAME)) {
            expires = request.getHeader(ExpiresHeader.NAME).getExpires()
        } else {
            expires = contactHeader.getExpires()
        }

        // Get response from header
        const response = authHeader.getResponse()
        // Get user from db or file
        let result = this.peersAPI.getPeer(authHeader.getUsername())
        let user

        if (result.status == Status.OK ) {
            user = result.obj
        } else {
            // Then lets check agents
            result = this.agentsAPI.getAgent(host, authHeader.getUsername())

            if (result.status == Status.OK ) {
                user = result.obj
            }
        }

        if (user == null) {
            LOG.warn('Could not find user or peer \'' + authHeader.getUsername() + '\'')
            return false
        }

        if (user.kind.equalsIgnoreCase('peer') && !isEmpty(user.spec.contactAddr)) {
            if (user.spec.contactAddr.contains(":")) {
                contactURI.setHost(user.spec.contactAddr.split(":")[0])
                contactURI.setPort(user.spec.contactAddr.split(":")[1])
            } else {
                contactURI.setHost(user.spec.contactAddr)
            }
        } else {
            if(!!viaHeader.getReceived()) contactURI.setHost(viaHeader.getReceived())
            if(!!viaHeader.getParameter('rport')) contactURI.setPort(viaHeader.getParameter('rport'))
        }

        if (user.kind.equalsIgnoreCase('agent') && !this.hasDomain(user, host)) {
            LOG.debug('User ' + user.spec.credentials.username + ' does not exist within domain ' + host)
            return false
        }

        const aHeaderJson = {
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

        if (new AuthHelper().calcFromHeader(aHeaderJson).equals(response)) {
            // Detect NAT
            const nat = (viaHeader.getHost() + viaHeader.getPort()) != (viaHeader.getReceived() + viaHeader.getParameter('rport'))

            const route = {
                isLinkAOR: false,
                thruGw: false,
                sentByAddress: viaHeader.getHost(),
                sentByPort: (viaHeader.getPort() == -1 ? 5060 : viaHeader.getPort()),
                received: viaHeader.getReceived(),
                rport: viaHeader.getParameter('rport'),
                contactURI: contactURI,
                registeredOn: Date.now(),
                expires: expires,
                nat: nat
            }

            if (user.kind.equalsIgnoreCase('peer')) {
                let peerHost = isEmpty(user.spec.device) ?  host : user.spec.device
                const addressOfRecord = this.addressFactory.createSipURI(user.spec.credentials.username, peerHost)
                addressOfRecord.setSecure(contactURI.isSecure())
                this.locator.addEndpoint(addressOfRecord, route)
            } else {
                user.spec.domains.forEach(domain => {
                    const addressOfRecord = this.addressFactory.createSipURI(user.spec.credentials.username, domain)
                    addressOfRecord.setSecure(contactURI.isSecure())
                    this.locator.addEndpoint(addressOfRecord, route)
                })
            }

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
}
