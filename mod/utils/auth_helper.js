/**
 * @author Pedro Sanders
 * @since v1
 */
module.exports = function AuthHelper (headerFactory) {
    const DigestUtils = Packages.org.apache.commons.codec.digest.DigestUtils
    const MessageDigest = Packages.java.security.MessageDigest
    const Long = Packages.java.lang.Long
    const Random = Packages.java.util.Random
    const DEFAULT_ALGORITHM = 'MD5'

    this.calcFromHeader = a => this.calculateResponse(a.username, a.secret, a.realm, a.nonce, a.nc, a.cnonce, a.uri,
        a.method, a.qop)

    this.calculateResponse = (username, secret, realm, nonce, nc, cnonce, uri, method, qop) => {
        const a1 = username + ':' + realm + ':' + secret
        const a2 = method.toUpperCase() + ':' + uri
        const ha1 = DigestUtils.md5Hex(a1)
        const ha2 =  DigestUtils.md5Hex(a2)

        if (qop != null && qop.equals('auth')) {
            return DigestUtils.md5Hex(ha1 + ':' + nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2)
        }

        return DigestUtils.md5Hex(ha1 + ':' + nonce +  ':' + ha2)
    }

    // Generates WWW-Authorization header
    this.generateChallenge = (realm) => {
        const wwwAuthHeader = headerFactory.createWWWAuthenticateHeader('Digest')
        wwwAuthHeader.setRealm(realm)
        wwwAuthHeader.setQop('auth')
        wwwAuthHeader.setOpaque('')
        wwwAuthHeader.setStale(false)
        wwwAuthHeader.setNonce(generateNonce())
        wwwAuthHeader.setAlgorithm(DEFAULT_ALGORITHM)
        return wwwAuthHeader
    }

    function generateNonce() {
        const date = new Date()
        const time = date.getTime()
        const rand = new Random()
        const pad = rand.nextLong()
        const nonceString = (new Long(time)).toString() + (new Long(pad)).toString()
        const messageDigest = MessageDigest.getInstance(DEFAULT_ALGORITHM)
        const mdbytes = messageDigest.digest(new java.lang.String(nonceString).getBytes())
        return DigestUtils.md5Hex(mdbytes)
    }
}
