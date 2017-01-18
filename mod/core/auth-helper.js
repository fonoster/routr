var DigestUtils = Java.type('org.apache.commons.codec.digest.DigestUtils')

function AuthHelper() {

    this.calcFromHeader = function(a) {
        return this.calculateResponse(a.username, a.password, a.realm, a.nonce, a.nc, a.cnonce, a.uri, a.method, a.qop)
    }

    this.calculateResponse = function(username, password, realm, nonce, nc, cnonce, uri, method, qop) {
        let ha1 = DigestUtils.md5Hex(username + ':' + realm + ':' + password)
        let ha2 =  DigestUtils.md5Hex(method + ':' + uri)

        return DigestUtils.md5Hex(ha1 + ':' + nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2)
    }
}