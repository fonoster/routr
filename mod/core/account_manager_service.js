/**
 * @author Pedro Sanders
 * @since v1
 */
const AccountManager  = Packages.gov.nist.javax.sip.clientauthutils.AccountManager
const UserCredentials = Packages.gov.nist.javax.sip.clientauthutils.UserCredentials

// There is something mysterious about this class that
// makes gatewaysAPI null beyond the constructor.
// The only way it works is by using this a global :(
var gatewaysAPI

/**
 * This serves as an authentication helper for Gateways
 */
export default class AccountManagerService {

    constructor(dataAPIs) {
        gatewaysAPI = dataAPIs.GatewaysAPI
    }

    getGateway(ct) {
        const gwRef = ct.getRequest().getHeader('X-Gateway-Ref').value
        const response = gatewaysAPI.getGateway(gwRef)

        if (response.status == 200) {
            const gateway = response.result

            return {
                username: gateway.spec.regService.credentials.username,
                secret: gateway.spec.regService.credentials.secret,
                host: gateway.spec.regService.host
            }
        }

        return {}
    }

    getAccountManager() {
        var getGateway = this.getGateway

        return new AccountManager({
            getCredentials: function (challengedTransaction, realm) {
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


