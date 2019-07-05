/**
 * @author Pedro Sanders
 * @since v1
 */
const isEmpty = require('@routr/utils/obj_util')
const getConfig = require('@routr/core/config_util')

const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const ExpiresHeader = Java.type('javax.sip.header.ExpiresHeader')
const SipFactory = Java.type('javax.sip.SipFactory')
const addressFactory = SipFactory.getInstance().createAddressFactory()

class RegistrarUtils {

    static generateAors(request, user, isGuest) {
        const contactHeader = request.getHeader(ContactHeader.NAME)
        const contactURI = contactHeader.getAddress().getURI()
        const aors = []

        if (isGuest || user.kind.equalsIgnoreCase('peer')) {
            const host = RegistrarUtils.getFromHost(request)
            const peerHost = isEmpty(user.spec.device) ? host : user.spec.device
            const addressOfRecord = addressFactory.createSipURI(user.spec.credentials.username, peerHost)
            addressOfRecord.setSecure(contactURI.isSecure())
            aors.push(addressOfRecord)
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
        return RegistrarUtils.getFromHost(request).equalsIgnoreCase('guest')
    }

    static isAllowGuest() {
        return getConfig().spec.allowGuest === true
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
            contactURI: RegistrarUtils.getUpdatedContactURI(request, user),
            registeredOn: Date.now(),
            expires: RegistrarUtils.getExpires(request),
            nat: RegistrarUtils.isNat(request)
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
        } else if (RegistrarUtils.useInternalInterface(request)) {
            if (viaHeader.getReceived() !== null) {
                contactURI.setHost(viaHeader.getReceived())
            }

            if (viaHeader.getParameter('rport') !== null) {
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
        return viaHeader.getTransport().equalsIgnoreCase('udp') ? true : false
    }

    static buildAuthHeader(user, authHeader) {
        return {
            username: user.spec.credentials.username,
            secret: user.spec.credentials.secret,
            realm: authHeader.getRealm(),
            nonce: authHeader.getNonce(),
            // For some weird reason the interface value is an int while the value original value is a string
            nc: RegistrarUtils.getNonceCount(authHeader.getNonceCount()),
            cnonce: authHeader.getCNonce(),
            uri: authHeader.getURI().toString(),
            method: 'REGISTER',
            qop: authHeader.getQop()
        }
    }

    static getExpires(request) {
        const contactHeader = request.getHeader(ContactHeader.NAME)
        return request.getHeader(ExpiresHeader.NAME) ? request.getHeader(ExpiresHeader.NAME).getExpires() :
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

module.exports = RegistrarUtils