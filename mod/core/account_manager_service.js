/**
 * @author Pedro Sanders
 * @since v1
 */
const AccountManager  = Packages.gov.nist.javax.sip.clientauthutils.AccountManager
const UserCredentials = Packages.gov.nist.javax.sip.clientauthutils.UserCredentials

/**
 * This serves as an authentication helper for Gateways
 */
export default function AccountManagerService(dataAPIs) {
    var gwAPI = dataAPIs.GatewaysAPI
    var self = this

    function getGateway(ct) {
        const gwRef = ct.getRequest().getHeader('GwRef').value
        const result = gwAPI.getGatewayByRef(gwRef)

        if (result.status == 200) {
            const gateway = result.obj

            return {
                username: gateway.spec.regService.credentials.username,
                secret: gateway.spec.regService.credentials.secret,
                host: gateway.spec.regService.host
            }
        }

        return {}
    }

    self.getAccountManager = function() {
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


