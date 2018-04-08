/**
 * @author Pedro Sanders
 * @since v1
 */
import ProcessorUtils from 'core/processor/utils'
import RegisterHandler from 'core/processor/register_handler'
import CancelHandler from 'core/processor/cancel_handler'
import RequestHandler from 'core/processor/request_handler'
import RouteInfo from 'core/processor/route_info'
import getConfig from 'core/config_util'
import AclUtil from 'core/acl/acl_util'
import { RoutingType } from 'core/routing_type'
import { Status } from 'core/status'

const SipFactory = Packages.javax.sip.SipFactory
const Request = Packages.javax.sip.message.Request
const Response = Packages.javax.sip.message.Response

export default class RequestProcessor {

    constructor(sipProvider, locator, registrar, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.contextStorage = contextStorage
        this.locator = locator
        this.registrar = registrar
        this.dataAPIs = dataAPIs
        this.domainsAPI = dataAPIs.DomainsAPI
        this.messageFactory = SipFactory.getInstance().createMessageFactory()
        this.config = getConfig()
    }

    process(event) {
        const request = event.getRequest()
        const method = request.getMethod()

        let serverTransaction = event.getServerTransaction()

        if (serverTransaction == null) {
            serverTransaction = this.sipProvider.getNewServerTransaction(request)
        }

        const procUtils = new ProcessorUtils(request, serverTransaction, this.messageFactory)

        if (this.allowedAccess(event) == false) {
            return procUtils.sendResponse(Response.FORBIDDEN)
        }

        switch (method) {
            case Request.REGISTER:
              new RegisterHandler(this.locator, this.registrar).doProcess(request, serverTransaction)
              break
            case Request.CANCEL:
              new CancelHandler(this.sipProvider, this.contextStorage).doProcess(request, serverTransaction)
              break
            default:
              new RequestHandler(this.locator, this.sipProvider, this.dataAPIs, this.contextStorage)
                .doProcess(request, serverTransaction)
        }
    }

    allowedAccess(event) {
        const request = event.getRequest()
        const remoteIp = event.getRemoteIpAddress()
        const routeInfo = new RouteInfo(request, this.dataAPIs)
        const acl = this.config.spec.accessControlList

        if(acl) {
            if(new AclUtil(acl).isIpAllowed(remoteIp) == false) {
                return false
            }
        }

        const addressOfRecord = ProcessorUtils.getAOR(request)

        if (routeInfo.getRoutingType().equals(RoutingType.INTRA_DOMAIN_ROUTING)) {
            const response = this.domainsAPI.getDomainByUri(addressOfRecord.getHost())
            if (response.status == Status.OK) {
                const acl  = response.result.spec.context.accessControlList
                if(acl && new AclUtil(acl).isIpAllowed(remoteIp) == false) {
                    return false
                }
            }
        }
        return true
    }

}
