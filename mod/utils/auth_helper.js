/**
 * @author Pedro Sanders
 * @since v1
 */
const DigestUtils = Java.type('org.apache.commons.codec.digest.DigestUtils')
const MessageDigest = Java.type('java.security.MessageDigest')
const Long = Java.type('java.lang.Long')
const Random = Java.type('java.util.Random')
const SipFactory = Java.type('javax.sip.SipFactory')
const headerFactory = SipFactory.getInstance().createHeaderFactory()
const DEFAULT_ALGORITHM = 'MD5'

class AuthHelper {

    static calcFromHeader(a) {
        return AuthHelper.calculateResponse(a.username, a.secret, a.realm,
            a.nonce, a.nc, a.cnonce, a.uri, a.method, a.qop)
    }

    static calculateResponse(username, secret, realm, nonce, nc, cnonce, uri, method, qop) {
        const a1 = username + ':' + realm + ':' + secret
        const a2 = method.toUpperCase() + ':' + uri
        const ha1 = DigestUtils.md5Hex(a1)
        const ha2 = DigestUtils.md5Hex(a2)

        if (qop !== null && qop.equals('auth')) {
            return DigestUtils.md5Hex(ha1 + ':' + nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2)
        }

        return DigestUtils.md5Hex(ha1 + ':' + nonce + ':' + ha2)
    }

    // Generates WWW-Authorization header
    static generateChallenge(realm) {
        const wwwAuthHeader = headerFactory.createWWWAuthenticateHeader('Digest')
        wwwAuthHeader.setRealm(realm)
        wwwAuthHeader.setQop('auth')
        wwwAuthHeader.setOpaque('')
        wwwAuthHeader.setStale(false)
        wwwAuthHeader.setNonce(AuthHelper.generateNonce())
        wwwAuthHeader.setAlgorithm(DEFAULT_ALGORITHM)
        return wwwAuthHeader
    }

    static generateNonce() {
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

module.exports = AuthHelper
