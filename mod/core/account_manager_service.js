/**
 * @author Pedro Sanders
 * @since v1
 */
function AccountManagerService(resourcesAPI) {
    const AccountManager  = Packages.gov.nist.javax.sip.clientauthutils.AccountManager
    const UserCredentials = Packages.gov.nist.javax.sip.clientauthutils.UserCredentials

    this.getAccountManager = () =>  new AccountManager() {
        getCredentials: (challengedTransaction, realm) => new UserCredentials() {
            getUserName: () => resourcesAPI.findGateway(challengedTransaction).spec.regService.username,
            getPassword: () => resourcesAPI.findGateway(challengedTransaction).spec.regService.secret,
            getSipDomain: () => resourcesAPI.findGateway(challengedTransaction).spec.regService.host
        }
    }
}
