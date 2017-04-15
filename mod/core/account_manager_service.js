/**
 * @author Pedro Sanders
 * @since v1
 */
function AccountManagerService(resourcesAPI) {
    const AccountManager  = Packages.gov.nist.javax.sip.clientauthutils.AccountManager
    const UserCredentials = Packages.gov.nist.javax.sip.clientauthutils.UserCredentials

    this.getAccountManager = () =>  new AccountManager() {
        getCredentials: (challengedTransaction, realm) => new UserCredentials() {
            getUserName: () => resourcesAPI.findGateway(challengedTransaction).username,
            getPassword: () => resourcesAPI.findGateway(challengedTransaction).secret,
            getSipDomain: () => resourcesAPI.findGateway(challengedTransaction).host
        }
    }
}
