var AccountManager  = Java.type('gov.nist.javax.sip.clientauthutils.AccountManager')
var UserCredentials = Java.type('gov.nist.javax.sip.clientauthutils.UserCredentials')
var LogManager      = Java.type('org.apache.logging.log4j.LogManager')

load('mod/core/yaml_converter.js')

// This implementation will locate peers at config/peers.yml
function getPeerFromConfig(username) {
    let peers = new YamlToJsonConverter().getJson('config/peers.yml')

    for (var peer of peers) {
        if (peer.username.equals(username)) {
            return peer
        }
    }

    LOG.warn ("Peer " + username + " does not exist in config/peers.yml")
    return null
}

function getUsernameFromContact(address) {
    return address.toString().split(":")[1].split("@")[0]
}

function AccountManagerService(getPeer = getPeerFromConfig) {
    let LOG = LogManager.getLogger()

    this.getAccountManager = function() {
        let getAccountManagerImpl = new AccountManager() {
            getCredentials: function(challengedTransaction, realm) {
                return new UserCredentials() {
                    getUserName: function() {
                        let username = getUsernameFromContact(challengedTransaction.getOriginalRequestContact().getAddress())
                        return getPeer(username).username
                    },
                    getPassword: function() {
                        let username = getUsernameFromContact(challengedTransaction.getOriginalRequestContact().getAddress())
                        return getPeer(username).secret
                    },
                    getSipDomain: function() {
                        let username = getUsernameFromContact(challengedTransaction.getOriginalRequestContact().getAddress())
                        return getPeer(username).host
                    }
                }
            }
        }

        return getAccountManagerImpl
    }
}