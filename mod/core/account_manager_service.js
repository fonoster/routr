var AccountManager  = Java.type('gov.nist.javax.sip.clientauthutils.AccountManager')
var UserCredentials = Java.type('gov.nist.javax.sip.clientauthutils.UserCredentials')
var LogManager      = Java.type('org.apache.logging.log4j.LogManager')

load('mod/utils/yaml_converter.js')
var LOG = LogManager.getLogger()

// This implementation will locate gateways at config/gateways.yml
function getGwFromConfig(ct) {
    print ("ct -> " + ct)
    let gateways = new YamlToJsonConverter().getJson('config/gateways.yml')
    let address = ct.getOriginalRequestContact().getAddress()
    let username = address.toString().split(":")[1].split("@")[0].toString()

    print ("username -> " + username)

    for (var gateway of gateways) {
        print ("gateway.username -> " + gateway.username)
        if (gateway.username === username) {

            return gateway
        }
    }

    LOG.warn ("Gateway '" + username + "' does not exist in config/gateways.yml")
    return null
}

function AccountManagerService(getGateway = getGwFromConfig) {
    print ("getGateway = " + getGateway)

    this.getAccountManager = function() {
        return new AccountManager() {
            getCredentials: function(challengedTransaction, realm) {
                return new UserCredentials() {
                    getUserName: function() {
                        print("XXXXX -> " + getGateway(challengedTransaction).username)
                        return getGateway(challengedTransaction).username
                    },
                    getPassword: function() {
                        print("XXXXX -> " + getGateway(challengedTransaction).secret)
                        return getGateway(challengedTransaction).secret
                    },
                    getSipDomain: function() {
                        print("XXXXX -> " + getGateway(challengedTransaction).host)
                        return getGateway(challengedTransaction).host
                    }
                }
            }
        }
    }
}