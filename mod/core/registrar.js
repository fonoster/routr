/**
 * @author Pedro Sanders
 * @since v1
 */
import AuthHelper from 'utils/auth_helper'
import { Status } from 'resources/status'

const ViaHeader = Packages.javax.sip.header.ViaHeader
const ContactHeader = Packages.javax.sip.header.ContactHeader
const FromHeader = Packages.javax.sip.header.FromHeader
const ExpiresHeader = Packages.javax.sip.header.ExpiresHeader
const AuthorizationHeader = Packages.javax.sip.header.AuthorizationHeader
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const SipFactory = Packages.javax.sip.SipFactory
const addressFactory = SipFactory.getInstance().createAddressFactory()

export default function RegistrarService(locationService, dataAPIs) {
    const pAPI = dataAPIs.PeersAPI
    const aAPI = dataAPIs.AgentsAPI
    const self = this

    function hasDomain(user, domain) {
        if (user.spec.domains == null || user.spec.domains.length == 0) return false
        let result = false
        user.spec.domains.forEach(function(d) {
            if (domain === d) result=true
        })
        return result
    }

    function getNonceCount(d) {
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

    self.register = function(rin) {
        // For some reason this references the parent object
        // to avoid I just clone it!
        const request = rin.clone()
        const viaHeader = request.getHeader(ViaHeader.NAME)
        const authHeader = request.getHeader(AuthorizationHeader.NAME)
        const contactHeader = request.getHeader(ContactHeader.NAME)
        const contactURI = contactHeader.getAddress().getURI()
        const fromHeader = request.getHeader(FromHeader.NAME)
        const fromURI = fromHeader.getAddress().getURI()
        const expires = request.getHeader(ExpiresHeader.NAME).getExpires() || contactHeader.getExpires()
        const host = fromURI.getHost()

        // Get response from header
        const response = authHeader.getResponse()
        // Get user from db or file
        let result = pAPI.getPeer(authHeader.getUsername())
        let user

        if (result.status == Status.OK ) {
            user = result.obj
        } else {
            // Then lets check agents
            result = aAPI.getAgent(host, authHeader.getUsername())

            if (result.status == Status.OK ) {
                user = result.obj
            }
        }

        if(!!viaHeader.getReceived()) contactURI.setHost(viaHeader.getReceived())
        if(!!viaHeader.getParameter('rport')) contactURI.setPort(viaHeader.getParameter('rport'))

        if (user == null) {
            LOG.warn('Could not find user or peer \'' + authHeader.getUsername() + '\'')
            return false
        }

        if(!!viaHeader.getReceived()) contactURI.setHost(viaHeader.getReceived())
        if(!!viaHeader.getParameter('rport')) contactURI.setPort(viaHeader.getParameter('rport'))

        if (user.kind.equalsIgnoreCase('agent') && !hasDomain(user, host)) {
            LOG.debug('User ' + user.spec.credentials.username + ' does not exist within domain ' + host)
            return false
        }

        const aHeaderJson = {
            username: user.spec.credentials.username,
            secret: user.spec.credentials.secret,
            realm: authHeader.getRealm(),
            nonce: authHeader.getNonce(),
            // For some weird reason the interface value is an int while the value original value is a string
            nc: getNonceCount(authHeader.getNonceCount()),
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
                thruGW: false,
                sentByAddress: viaHeader.getHost(),
                sentByPort: viaHeader.getPort(),
                received: viaHeader.getReceived(),
                rport: viaHeader.getParameter('rport'),
                contactURI: contactURI,
                registeredOn: Date.now(),
                expires: expires,
                nat: nat
            }

            if (user.kind.equalsIgnoreCase('peer')) {
                let peerHost = host

                if (user.spec.host) {
                    peerHost = user.spec.host
                }

                const addressOfRecord = addressFactory.createSipURI(user.spec.credentials.username, peerHost)
                addressOfRecord.setSecure(contactURI.isSecure())
                locationService.addEndpoint(addressOfRecord, route)
            } else {
                user.spec.domains.forEach(domain => {
                    const addressOfRecord = addressFactory.createSipURI(user.spec.credentials.username, domain)
                    addressOfRecord.setSecure(contactURI.isSecure())
                    locationService.addEndpoint(addressOfRecord, route)
                })
            }

            return true
        }
        return false
    }
}
