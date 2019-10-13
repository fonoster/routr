/**
 * @author Pedro Sanders
 * @since v1
 */
const {
    buildAddr,
    fixPort
} = require('@routr/utils/misc_utils')
const StringBuilder = Java.type('java.lang.StringBuilder')
const SipFactory = Java.type('javax.sip.SipFactory')
const addressFactory = SipFactory.getInstance().createAddressFactory()

class LocatorUtils {

    static getPort(uri) {
        const uriObj = LocatorUtils.aorAsObj(uri)
        return fixPort(uriObj.getPort())
    }

    static expiredRouteFilter(route) {
        const elapsed = (Date.now() - route.registeredOn) / 1000
        return route.expires - elapsed <= 0
    }

    static contactURIFilter(c1, c2) {
        return c1 === c2
    }

    static aorAsString(addressOfRecord) {
        if (addressOfRecord instanceof Java.type('javax.sip.address.SipURI')) {
            const strBuilder = new StringBuilder(addressOfRecord.isSecure() ? 'sips:' : 'sip:')

            if (addressOfRecord.getUser()) {
                strBuilder
                    .append(addressOfRecord.getUser())
                    .append('@')
            }

            return strBuilder.append(addressOfRecord.getHost()).toString()
        } else if (addressOfRecord instanceof Java.type('javax.sip.address.TelURL')) {
            return 'tel:' + addressOfRecord.getPhoneNumber()
        } else if (typeof(addressOfRecord) === 'string' || addressOfRecord instanceof String) {
            if (/sips?:.*@.*/.test(addressOfRecord) ||
                /tel:\d+/.test(addressOfRecord)) {
                return addressOfRecord
            }
        }
    }

    static aorAsObj(addressOfRecord) {
        if (typeof(addressOfRecord) === 'string' || addressOfRecord instanceof String) {
            const rx = /sip?:(.*)@(.*)/
            if (rx.test(addressOfRecord)) {
                const addr = rx.exec(addressOfRecord)
                return addressFactory.createSipURI(addr[1], addr[2])
            } else if (/tel:\d+/.test(addressOfRecord)) {
                return addressFactory.createTelURI(addressOfRecord)
            }
        } else if (addressOfRecord instanceof Java.type('javax.sip.address.SipURI') ||
            addressOfRecord instanceof Java.type('javax.sip.address.TelURL')) {
            return addressOfRecord
        }

        throw `Invalid AOR: ${addressOfRecord}`
    }

    static buildForwardRoute(addressOfRecord, contactURI) {
        return [{
            addressOfRecord: addressOfRecord,
            isLinkAOR: false,
            thruGw: false,
            contactURI: contactURI
        }]
    }

    static buildEgressRoute(addressOfRecord, contactURI, gateway, number,
        domain) {
        const username = gateway.spec.credentials ? gateway.spec.credentials.username :
            null
        const route = {
            addressOfRecord: addressOfRecord,
            isLinkAOR: false,
            thruGw: true,
            gwUsername: username,
            gwRef: gateway.metadata.ref,
            gwHost: buildAddr(gateway.spec.host, gateway.spec.port),
            numberRef: number.metadata.ref,
            number: number.spec.location.telUrl.split(':')[1],
            contactURI: contactURI,
            expires: -1
        }
        if (domain) {
            route.rule = domain.spec.context.egressPolicy.rule
        }
        return route
    }
}

module.exports = LocatorUtils
