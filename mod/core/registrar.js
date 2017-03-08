/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/utils/auth_helper.js')

function RegistrarService(location, resourcesAPI) {
    const ViaHeader = Packages.javax.sip.header.ViaHeader
    const ContactHeader = Packages.javax.sip.header.ContactHeader
    const ToHeader = Packages.javax.sip.header.ToHeader
    const AuthorizationHeader = Packages.javax.sip.header.AuthorizationHeader
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()

    function hasDomain(user, domain) {
        for (var d of user.domains) {
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
        const toHeader = request.getHeader(ToHeader.NAME)
        const toURI = toHeader.getAddress().getURI()
        const domain = toURI.getHost()

        // This scenario will happen with webclients
        if (contactURI.getHost().endsWith('.invalid')) {
            contactURI.setUser(authHeader.getUsername())
            contactURI.setHost(viaHeader.getReceived())
            contactURI.setPort(viaHeader.getParameter('rport'))
        }

        // Get response from header
        const response = authHeader.getResponse()
        // Get username and password from "db:
        const user = resourcesAPI.findUser(authHeader.getUsername())

        if (user == null) {
            LOG.info('Could not find user or peer \'' + authHeader.getUsername() + '\'')
            return false
        }

        if (user.kind.equalsIgnoreCase('agent') && !hasDomain(user, domain)) {
            LOG.info('User ' + user.username + ' does not exist in domain ' + domain)
            return false
        }

        const aHeaderJson = {
            username: authHeader.getUsername(),
            password: user.secret,
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

            if (user.kind.equalsIgnoreCase('peer')) {
                if (user.host != null) {
                    contactURI.setHost(user.host)
                }

                const endpoint = 'sip:' + authHeader.getUsername() + '@' + domain
                location.put(endpoint, contactURI)

                LOG.debug('The endpoint ' + endpoint + ' is ' + contactURI + ' in Sip I/O')
            } else {
                for (var d of user.domains) {
                    // TODO: Find a better way to get this value
                    // This could be "sips" or other protocol
                    const endpoint = 'sip:' + authHeader.getUsername() + '@' + d
                    location.put(endpoint, contactURI)
                    LOG.trace('The endpoint ' + endpoint + ' is now ' + contactURI + ' in Sip I/O')
                }
            }

            return true
        }
        return false
    }
}