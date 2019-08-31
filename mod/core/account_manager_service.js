/**
 * @author Pedro Sanders
 * @since v1
 */
const { gatewayPatch } = require('@routr/utils/misc_util')
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
                host: gatewayPatch(gateway.spec.host, gateway.spec.port)
            }
        }

        return {}
    }

    getAccountManager() {
        const self = this

        return new AccountManager({
            getCredentials: (challengedTransaction, realm) => {
                const gateway = self.getGateway(challengedTransaction)

                return new UserCredentials({
                    getUserName: () => gateway.username,
                    getPassword: () => gateway.secret,
                    getSipDomain: () => gateway.host
                })
            }
        })
    }
}

module.exports = AccountManagerService
