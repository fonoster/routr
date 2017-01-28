var AccountManager  = Java.type('gov.nist.javax.sip.clientauthutils.AccountManager')
var UserCredentials = Java.type('gov.nist.javax.sip.clientauthutils.UserCredentials')
var LogManager      = Java.type('org.apache.logging.log4j.LogManager')

load('mod/utils/yaml_converter.js')
var LOG = LogManager.getLogger()

// This implementation will locate peers at config/peers.yml
function getPeerFromConfig(ct) {
    let peers = new YamlToJsonConverter().getJson('config/peers.yml')
    let address = ct.getOriginalRequestContact().getAddress()
    let username = address.toString().split(":")[1].split("@")[0].toString()

    for (var peer of peers) {
        if (peer.username === username) {
            return peer
        }
    }

    LOG.warn ("Peer '" + username + "' does not exist in config/peers.yml")
    return null
}

function AccountManagerService(getPeer = getPeerFromConfig) {
    this.getAccountManager = function() {
        return new AccountManager() {
            getCredentials: function(challengedTransaction, realm) {
                return new UserCredentials() {
                    getUserName: function() {
                        return getPeer(challengedTransaction).username
                    },
                    getPassword: function() {
                        return getPeer(challengedTransaction).secret
                    },
                    getSipDomain: function() {
                        return getPeer(challengedTransaction).host
                    }
                }
            }
        }
    }
}