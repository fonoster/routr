/**
 * @author Pedro Sanders
 * @since v1
 */
const {
    Status
} = require('@routr/core/status')

const AccountManager = Java.type('gov.nist.javax.sip.clientauthutils.AccountManager')
const UserCredentials = Java.type('gov.nist.javax.sip.clientauthutils.UserCredentials')

// There is something mysterious about this class that
// makes gatewaysAPI null beyond the constructor.
// The only way it works is by using this a global :(
var gatewaysAPI

/**
 * This serves as an authentication helper for Gateways
 */
class AccountManagerService {

    constructor(dataAPIs) {
        gatewaysAPI = dataAPIs.GatewaysAPI
    }

    getGateway(ct) {
        const gwRef = ct.getRequest().getHeader('X-Gateway-Ref').value
        const response = gatewaysAPI.getGateway(gwRef)

        if (response.status === Status.OK) {
            const gateway = response.result

            return {
                username: gateway.spec.credentials.username,
                secret: gateway.spec.credentials.secret,
                host: gateway.spec.host
            }
        }

        return {}
    }

    getAccountManager() {
        var getGateway = this.getGateway

        return new AccountManager({
            getCredentials: function(challengedTransaction, realm) {
                return new UserCredentials({
                    getUserName: function() {
                        return getGateway(challengedTransaction).username
                    },
                    getPassword: function() {
                        return getGateway(challengedTransaction).secret
                    },
                    getSipDomain: function() {
                        return getGateway(challengedTransaction).host
                    }
                })
            }
        })
    }
}

module.exports = AccountManagerService