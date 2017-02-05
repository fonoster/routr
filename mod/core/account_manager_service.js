var AccountManager  = Java.type('gov.nist.javax.sip.clientauthutils.AccountManager')
var UserCredentials = Java.type('gov.nist.javax.sip.clientauthutils.UserCredentials')
var LogManager      = Java.type('org.apache.logging.log4j.LogManager')

load('mod/utils/yaml_converter.js')
var LOG = LogManager.getLogger()

// This implementation will locate providers at config/providers.yml
function getProviderFromConfig(ct) {
    let providers = new YamlToJsonConverter().getJson('config/providers.yml')
    let address = ct.getOriginalRequestContact().getAddress()
    let username = address.toString().split(":")[1].split("@")[0].toString()

    for (var provider of providers) {
        if (provider.username === username) {
            return provider
        }
    }

    LOG.warn ("Provider '" + username + "' does not exist in config/providers.yml")
    return null
}

function AccountManagerService(getProvider = getProviderFromConfig) {
    this.getAccountManager = function() {
        return new AccountManager() {
            getCredentials: function(challengedTransaction, realm) {
                return new UserCredentials() {
                    getUserName: function() {
                        return getProvider(challengedTransaction).username
                    },
                    getPassword: function() {
                        return getProvider(challengedTransaction).secret
                    },
                    getSipDomain: function() {
                        return getProvider(challengedTransaction).host
                    }
                }
            }
        }
    }
}