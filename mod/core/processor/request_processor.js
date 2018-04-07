/**
 * @author Pedro Sanders
 * @since v1
 */
import RegisterHandler from 'core/processor/register_handler'
import CancelHandler from 'core/processor/cancel_handler'
import RequestHandler from 'core/processor/request_handler'
import RouteInfo from 'core/processor/route_info'
import Context from 'core/context'
import AclUtil from 'core/acl/acl_util'
import getConfig from 'core/config_util'
import { Status } from 'core/status'
import { RoutingType } from 'core/routing_type'
import IPUtil from 'core/ip_util'

const SipFactory = Packages.javax.sip.SipFactory
const RouteHeader = Packages.javax.sip.header.RouteHeader
const ToHeader = Packages.javax.sip.header.ToHeader
const FromHeader = Packages.javax.sip.header.FromHeader
const ContactHeader = Packages.javax.sip.header.ContactHeader
const ViaHeader = Packages.javax.sip.header.ViaHeader
const MaxForwardsHeader = Packages.javax.sip.header.MaxForwardsHeader
const ProxyAuthorizationHeader = Packages.javax.sip.header.ProxyAuthorizationHeader
const Request = Packages.javax.sip.message.Request
const Response = Packages.javax.sip.message.Response
const HashMap = Packages.java.util.HashMap
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class RequestProcessor {

    constructor(sipProvider, locator, registry, registrar, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.sipStack = this.sipProvider.getSipStack()
        this.contextStorage = contextStorage
        this.locator = locator
        this.registry = registry
        this.dataAPIs = dataAPIs
        this.domainsAPI = dataAPIs.DomainsAPI
        this.peersAPI = dataAPIs.PeersAPI
        this.agentsAPI = dataAPIs.AgentsAPI
        this.didsAPI = dataAPIs.DIDsAPI
        this.messageFactory = SipFactory.getInstance().createMessageFactory()
        this.headerFactory = SipFactory.getInstance().createHeaderFactory()
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
        this.dsam = new Packages.gov.nist.javax.sip.clientauthutils.DigestServerAuthenticationHelper()
        this.config = getConfig()
        this.generalAcl = this.config.spec.accessControlList
        this.ipUtil = new IPUtil()
    }

    process(event) {
        const request = event.getRequest()
        const method = requestIn.getMethod()

        let serverTransaction = event.getServerTransaction()

        if (serverTransaction == null) {
            serverTransaction = this.sipProvider.getNewServerTransaction(request)
        }

        if (method.equals(Request.REGISTER)) {
            // Should we apply ACL rules here too?
            return new RegisterHandler(this.locator, this.registrar).register(request, serverTransaction)
        }

        if(method.equals(Request.CANCEL)) {
            return new CancelHandler(this.sipProvider, this.contextStorage).cancel(request, serverTransaction)
        }

        new RequestHandler().doProcess(request, serverTransaction)
    }
}
