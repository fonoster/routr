/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/core/resources.js')

function AccountManagerService(getGateway = getGWFromConfig) {
    const AccountManager  = Packages.gov.nist.javax.sip.clientauthutils.AccountManager
    const UserCredentials = Packages.gov.nist.javax.sip.clientauthutils.UserCredentials

    this.getAccountManager = () =>  new AccountManager() {
        getCredentials: (challengedTransaction, realm) => new UserCredentials() {
            getUserName: () => getGateway(challengedTransaction).username,
            getPassword: () => getGateway(challengedTransaction).secret,
            getSipDomain: () => getGateway(challengedTransaction).host
        }
    }
}



