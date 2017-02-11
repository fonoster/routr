var DigestUtils = Java.type('org.apache.commons.codec.digest.DigestUtils')
var LogManager  = Java.type('org.apache.logging.log4j.LogManager')

function AuthHelper(headerFactory) {
    let LOG = LogManager.getLogger()

    this.calcFromHeader = function(a) {
        return this.calculateResponse(a.username, a.password, a.realm, a.nonce, a.nc, a.cnonce, a.uri, a.method, a.qop)
    }

    this.calculateResponse = function(username, password, realm, nonce, nc, cnonce, uri, method, qop) {
        let a1 = username + ':' + realm + ':' + password
        let a2 = method + ':' + uri
        let ha1 = DigestUtils.md5Hex(a1)
        let ha2 =  DigestUtils.md5Hex(a2)
        var result

        if (qop != null && qop.equals("auth")) {
            result = DigestUtils.md5Hex(ha1 + ':' + nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2)
        } else {
            result = DigestUtils.md5Hex(ha1 + ':' + nonce +  ':' + ha2)
        }

        LOG.trace("A1: " + a1)
        LOG.trace("A2: " + a2)
        LOG.trace("HA1: " + ha1)
        LOG.trace("HA2: " + ha2)
        LOG.trace("Result: " + result)

        return result
    }

        // Generates WWW-Authorization header
    this.generateChallenge = function() {
        let wwwAuthHeader = headerFactory.createWWWAuthenticateHeader("Digest")
        wwwAuthHeader.setDomain("fonoster.com")
        wwwAuthHeader.setRealm("fonoster")
        wwwAuthHeader.setQop("auth")
        wwwAuthHeader.setOpaque("")
        wwwAuthHeader.setStale(false)
        wwwAuthHeader.setNonce("0ee55540a2e316dae22c804cdb383f5b")     // TODO: Generate a random nonce
        wwwAuthHeader.setAlgorithm("MD5")
        return wwwAuthHeader
    }
}