load('mod/core/auth-helper.js')
load('mod/core/yaml-converter.js')

// This implementation will locate agents at config/agents.yml
function getUserFromConfig(username) {
    let users = new YamlToJsonConverter().getJson('config/agents.yml')

    for (var user of users) {
        if (user.username === username) {
            return user
        }
    }
    return null
}

function RegistrarService(location, getUser = getUserFromConfig) {
    let authHelper = new AuthHelper()

    function hasDomain(user, domain) {
        for (var d of user.domains) {
           if (domain === d) return true
        }
        return false
    }

    function getNonceCount(d) {
        let h = Java.type("java.lang.Integer").toHexString(d)
        let cSize = 8 - h.toString().length() 
        let nc = ''
        let cnt = 0

        while (cSize > cnt) {
            nc += "0"
            cnt++
        }

        return nc + h
    }

    this.register = function(authHeader, agentDomain, contactURI) {
        // Get response from header
        let response = authHeader.getResponse()
        // Get username and password from "db:
        let user = getUser(authHeader.getUsername())

        if (user == null || !hasDomain(user, agentDomain)) return false

        let aHeaderJson = {
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

            for (var domain of user.domains) {
                // TODO: Find a better way to get this value
                location.put("sip:" + authHeader.getUsername() + "@" + domain, contactURI)
            }

            return true
        }
        return false
    }
}