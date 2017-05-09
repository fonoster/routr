/**
 * @author Pedro Sanders
 * @since v1
 */
function AccountManagerService(dataAPIs) {
    const AccountManager  = Packages.gov.nist.javax.sip.clientauthutils.AccountManager
    const UserCredentials = Packages.gov.nist.javax.sip.clientauthutils.UserCredentials
    const gwAPI = dataAPIs.getGatewaysAPI()

    function getUser(ct) {
        const gwUsernameHeader = ct.getRequest().getHeader('GWUsername').value
        const result = gwAPI.getGWByUsername(gwUsernameHeader)

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

    this.getAccountManager = () =>  new AccountManager() {
        getCredentials: (challengedTransaction, realm) => new UserCredentials() {
           getUserName: () => getUser(challengedTransaction).username,
           getPassword: () => getUser(challengedTransaction).secret,
           getSipDomain: () => getUser(challengedTransaction).host
        }
    }
}
