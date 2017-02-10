var AccountManager  = Java.type('gov.nist.javax.sip.clientauthutils.AccountManager')
var UserCredentials = Java.type('gov.nist.javax.sip.clientauthutils.UserCredentials')
var LogManager      = Java.type('org.apache.logging.log4j.LogManager')

load('mod/utils/yaml_converter.js')
var LOG = LogManager.getLogger()

// This implementation will locate gateways at config/gateways.yml
function getGWFromConfig(ct) {
    let gateways = new YamlToJsonConverter().getJson('config/gateways.yml')
    let address = ct.getOriginalRequestContact().getAddress()
    let username = address.toString().split(":")[1].split("@")[0].toString()

    for (var gateway of gateways) {
        if (gateway.username === username) {

            return gateway
        }
    }

    LOG.warn ("Gateway '" + username + "' does not exist in config/gateways.yml")
    return null
}

function AccountManagerService(getGateway = getGWFromConfig) {
    this.getAccountManager = function() {
        return new AccountManager() {
            getCredentials: function(challengedTransaction, realm) {
                return new UserCredentials() {
                    getUserName: function() {
                        return getGateway(challengedTransaction).username
                    },
                    getPassword: function() {
                        return getGateway(challengedTransaction).secret
                    },
                    getSipDomain: function() {
                        return getGateway(challengedTransaction).host
                    }
                }
            }
        }
    }
}