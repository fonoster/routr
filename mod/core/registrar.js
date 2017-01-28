var LogManager = Java.type('org.apache.logging.log4j.LogManager')

load('mod/utils/yaml_converter.js')
load('mod/utils/auth_helper.js')

// This implementation will locate agents or peers at config/agents.yml or config/peers.yml
function getUserFromConfig(username) {
    let agents = new YamlToJsonConverter().getJson('config/agents.yml')
    let peers = new YamlToJsonConverter().getJson('config/peers.yml')

    for (var peer of peers) {
        if (peer.username === username) {
            return peer
        }
    }

    for (var agent of agents) {
        if (agent.username === username) {
            return agent
        }
    }

    return null
}

function RegistrarService(location, getUser = getUserFromConfig) {
    let authHelper = new AuthHelper()
    let LOG = LogManager.getLogger()

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

    this.register = function(authHeader, uriDomain, contactURI) {
        // Get response from header
        let response = authHeader.getResponse()
        // Get username and password from "db:
        let user = getUser(authHeader.getUsername())

        if (user == null) {
            LOG.info("Could not find user or peer '" + authHeader.getUsername() + "'")
            return false
        }

        // TODO: Should verify if domain exist first...

        if (user.kind.equalsIgnoreCase('agent') && !hasDomain(user, uriDomain)) {
            LOG.info("User " + user.username + " does not exist in domain " + uriDomain)
            return false
        }

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

            if (user.kind.equalsIgnoreCase('peer')) {
                if (user.host != null) {
                    contactURI.setHost(user.host)
                }
                location.put("sip:" + authHeader.getUsername() + "@" + uriDomain, contactURI)
            } else {
                for (var domain of user.domains) {
                    // TODO: Find a better way to get this value
                    // This could be "sips" or other protocol
                    location.put("sip:" + authHeader.getUsername() + "@" + domain, contactURI)
                }
            }

            return true
        }
        return false
    }
}