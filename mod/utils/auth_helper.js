/**
 * @author Pedro Sanders
 * @since v1
 */
function AuthHelper(headerFactory) {
    const DigestUtils = Packages.org.apache.commons.codec.digest.DigestUtils
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()

    this.calcFromHeader = a => this.calculateResponse(a.username, a.password, a.realm, a.nonce, a.nc, a.cnonce, a.uri,
        a.method, a.qop)

    this.calculateResponse = (username, password, realm, nonce, nc, cnonce, uri, method, qop) => {
        const a1 = username + ':' + realm + ':' + password
        const a2 = method.toUpperCase() + ':' + uri
        const ha1 = DigestUtils.md5Hex(a1)
        const ha2 =  DigestUtils.md5Hex(a2)
        let result

        if (qop != null && qop.equals('auth')) {
            result = DigestUtils.md5Hex(ha1 + ':' + nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2)
        } else {
            result = DigestUtils.md5Hex(ha1 + ':' + nonce +  ':' + ha2)
        }

        LOG.trace('A1: ' + a1)
        LOG.trace('A2: ' + a2)
        LOG.trace('HA1: ' + ha1)
        LOG.trace('HA2: ' + ha2)
        LOG.trace('Result: ' + result)

        return result
    }

    // Generates WWW-Authorization header
    this.generateChallenge = () => {
        const wwwAuthHeader = headerFactory.createWWWAuthenticateHeader('Digest')
        wwwAuthHeader.setDomain('fonoster.com')
        wwwAuthHeader.setRealm('fonoster')
        wwwAuthHeader.setQop('auth')
        wwwAuthHeader.setOpaque('')
        wwwAuthHeader.setStale(false)
        wwwAuthHeader.setNonce('0ee55540a2e316dae22c804cdb383f5b')     // TODO: Generate a random nonce
        wwwAuthHeader.setAlgorithm('MD5')
        return wwwAuthHeader
    }
}