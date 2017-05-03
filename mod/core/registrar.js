/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/utils/auth_helper.js')

function RegistrarService(locationService, resourcesAPI) {
    const ViaHeader = Packages.javax.sip.header.ViaHeader
    const ContactHeader = Packages.javax.sip.header.ContactHeader
    const FromHeader = Packages.javax.sip.header.FromHeader
    const AuthorizationHeader = Packages.javax.sip.header.AuthorizationHeader
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()

    function hasDomain(user, domain) {
        for (var d of user.spec.domains) {
           if (domain === d) return true
        }
        return false
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

    this.register = (rin) => {
        // For some reason this references the parent object
        // to avoid I just clone it!
        request = rin.clone()
        const viaHeader = request.getHeader(ViaHeader.NAME)
        const authHeader = request.getHeader(AuthorizationHeader.NAME)
        const contactHeader = request.getHeader(ContactHeader.NAME)
        const contactURI = contactHeader.getAddress().getURI()
        const fromHeader = request.getHeader(FromHeader.NAME)
        const fromURI = fromHeader.getAddress().getURI()
        const host = fromURI.getHost()

        // Get response from header
        const response = authHeader.getResponse()
        // Get user from db or file
        const user = resourcesAPI.findUser(authHeader.getUsername())

        if(!!viaHeader.getReceived()) contactURI.setHost(viaHeader.getReceived())
        if(!!viaHeader.getParameter('rport')) contactURI.setPort(viaHeader.getParameter('rport'))

        if (user == null) {
            LOG.warn('Could not find user or peer \'' + authHeader.getUsername() + '\'')
            return false
        }

        if(!!viaHeader.getReceived()) contactURI.setHost(viaHeader.getReceived())
        if(!!viaHeader.getParameter('rport')) contactURI.setPort(viaHeader.getParameter('rport'))

        if (user.kind.equalsIgnoreCase('agent') && !hasDomain(user, host)) {
            LOG.debug('User ' + user.spec.access.username + ' does not exist within domain ' + host)
            return false
        }

        print ('user ~> ' + JSON.stringify(user))

        const aHeaderJson = {
            username: user.spec.access.username,
            password: user.spec.access.secret,
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
                sentByAddress: viaHeader.getHost(),
                sentByPort: viaHeader.getPort(),
                received: viaHeader.getReceived(),
                rport: viaHeader.getParameter('rport'),
                contactURI: contactURI,
                registeredOn: Date.now(),
                nat: nat
            }

            if (user.kind.equalsIgnoreCase('peer')) {
                if (user.host) host = user.spec.host

                const addressOfRecord = contactURI.getScheme() + ':' + user.spec.access.username + '@' + host
                locationService.addLocation(addressOfRecord, route)
            } else {
                for (var domain of user.spec.domains) {
                    addressOfRecord = contactURI.getScheme() + ':' + user.spec.access.username + '@' + domain
                    locationService.addLocation(addressOfRecord, route)
                }
            }

            return true
        }
        return false
    }
}