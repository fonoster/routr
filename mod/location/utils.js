/**
 * @author Pedro Sanders
 * @since v1
 */
const StringBuilder = Java.type('java.lang.StringBuilder')
const SipFactory = Java.type('javax.sip.SipFactory')
const addressFactory = SipFactory.getInstance().createAddressFactory()

class LocatorUtils {

    static fixPort(port) {
        return port === -1? 5060 : port
    }

    static getPort(uri) {
        const uriObj = LocatorUtils.aorAsObj(uri)
        return LocatorUtils.fixPort(uriObj.getPort())
    }

    static expiredRouteFilter(route) {
        const elapsed = (Date.now() - route.registeredOn) / 1000
        return route.expires - elapsed <= 0
    }

    static contactURIFilter(route, contactURI) {
        return route.contactURI.toString() === contactURI.toString()
    }

    static aorAsString(addressOfRecord) {
        if (addressOfRecord instanceof Java.type('javax.sip.address.SipURI')) {
            if (addressOfRecord.isSecure()) {
                return new StringBuilder()
                    .append('sips:')
                    .append(addressOfRecord.getUser())
                    .append('@')
                    .append(addressOfRecord.getHost()).toString()
            } else {
                return new StringBuilder()
                    .append('sip:')
                    .append(addressOfRecord.getUser())
                    .append('@')
                    .append(addressOfRecord.getHost()).toString()
            }
        } else if (addressOfRecord instanceof Java.type('javax.sip.address.TelURL')) {
            return 'tel:' + addressOfRecord.getPhoneNumber()
        } else if (typeof(addressOfRecord) === 'string' || addressOfRecord instanceof String) {
            if (/sips?:.*@.*/.test(addressOfRecord) ||
                /tel:\d+/.test(addressOfRecord)) {
                return addressOfRecord
            }
        }

        throw 'Invalid AOR: ' + addressOfRecord
    }

    static aorAsObj(addressOfRecord) {
        if (typeof(addressOfRecord) === 'string' || addressOfRecord instanceof String) {
            if (/sips?:.*@.*/.test(addressOfRecord)) {
                return LocatorUtils.createSipURI(addressOfRecord)
            } else if (/tel:\d+/.test(addressOfRecord)) {
                return addressFactory.createTelURI(addressOfRecord)
            }
        } else if (addressOfRecord instanceof Java.type('javax.sip.address.SipURI') ||
            addressOfRecord instanceof Java.type('javax.sip.address.TelURL')) {
            return addressOfRecord
        }

        throw 'Invalid AOR: ' + addressOfRecord
    }

    // Cheap implementation :(
    static createSipURI(fromString) {
        const user = fromString.substring(fromString.indexOf(':') + 1, fromString.indexOf('@'))
        const host = fromString.substring(fromString.indexOf('@') + 1, fromString.length)
        return addressFactory.createSipURI(user, host)
    }

    static buildForwardRoute(contactURI) {
        return [{
            isLinkAOR: false,
            thruGw: false,
            contactURI: contactURI
        }]
    }

    static buildEgressRoute(contactURI, gateway, did, domain) {
        const username = gateway.spec.credentials ? gateway.spec.credentials.username :
            null
        const route = {
            isLinkAOR: false,
            thruGw: true,
            gwUsername: username,
            gwRef: gateway.metadata.ref,
            gwHost: gateway.spec.host,
            didRef: did.metadata.ref,
            did: did.spec.location.telUrl.split(':')[1],
            contactURI: contactURI
        }
        if (domain) {
            route.rule = domain.spec.context.egressPolicy.rule
        }
        return route
    }
}

module.exports = LocatorUtils
