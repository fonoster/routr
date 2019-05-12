/**
 * @author Pedro Sanders
 * @since v1
 */
class LocatorUtils {

    static aorAsString(addressOfRecord) {
        if (addressOfRecord instanceof Packages.javax.sip.address.TelURL) {
            return 'tel:' + addressOfRecord.getPhoneNumber()
        } else if (addressOfRecord instanceof Packages.javax.sip.address.SipURI) {
            if (addressOfRecord.isSecure()) {
                return 'sips:' + addressOfRecord.getUser() + '@' + addressOfRecord.getHost()
            } else {
                return 'sip:' + addressOfRecord.getUser() + '@' + addressOfRecord.getHost()
            }
        } else {
            if (/sips?:.*@.*/.test(addressOfRecord) ||
                /tel:\d+/.test(addressOfRecord)) {
                return addressOfRecord
            }
           LOG.error('Invalid AOR: ' + addressOfRecord)
        }

        throw 'Invalid AOR: ' + addressOfRecord
    }

    static buildForwardRoute(contactURI) {
        return [{
            isLinkAOR: false,
            thruGw: false,
            contactURI: contactURI
        }]
    }

    static buildEgressRoute(contactURI, gateway, did, domain) {
        const route = {
            isLinkAOR: false,
            thruGw: true,
            gwUsername: gateway.spec.credentials.username,
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
