/**
 * @author Pedro Sanders
 * @since v1
 */
const ProcessorUtils = require('@routr/core/processor/utils')
const RegisterHandler = require('@routr/core/processor/register_handler')
const RegistryHandler = require('@routr/core/processor/registry_handler')
const CancelHandler = require('@routr/core/processor/cancel_handler')
const RequestHandler = require('@routr/core/processor/request_handler')
const RouteInfo = require('@routr/core/processor/route_info')
const getConfig = require('@routr/core/config_util')
const AclUtil = require('@routr/core/acl/acl_util')
const {
    RoutingType
} = require('@routr/core/routing_type')
const {
    Status
} = require('@routr/core/status')

const SipFactory = Java.type('javax.sip.SipFactory')
const Request = Java.type('javax.sip.message.Request')
const Response = Java.type('javax.sip.message.Response')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

const messageFactory = SipFactory.getInstance().createMessageFactory()
const globalACL = getConfig().spec.accessControlList

class RequestProcessor {

    constructor(sipProvider, dataAPIs, contextStorage) {
        this.sipProvider = sipProvider
        this.contextStorage = contextStorage
        this.dataAPIs = dataAPIs
        this.domainsAPI = dataAPIs.DomainsAPI
    }

    process(event) {
        const request = event.getRequest()
        let serverTransaction = event.getServerTransaction()

        if (serverTransaction === null && request.getMethod().equals(Request.ACK) === false) {
            serverTransaction = this.sipProvider.getNewServerTransaction(request)
        }

        const routeInfo = new RouteInfo(request, this.dataAPIs)
        const procUtils = new ProcessorUtils(request, serverTransaction)

        LOG.debug(`core.processor.RequestProcessor.process [route type ${routeInfo.getRoutingType()}]`)
        LOG.debug(`core.processor.RequestProcessor.process [entity info ${JSON.stringify(routeInfo.getCallee())}]`)

        // Warning: This is a very expensive function. Considere making it optional
        // Or optimize
        if (this.allowedAccess(event, routeInfo) === false) {
            LOG.debug(`core.processor.RequestProcessor.process [access denied for ${JSON.stringify(routeInfo.getCallee())}]`)
            return procUtils.sendResponse(Response.FORBIDDEN)
        }

        LOG.debug(`core.processor.RequestProcessor.process [running handler for method \`${request.getMethod()}\`]`)

        switch (request.getMethod()) {
            case Request.PUBLISH:
            case Request.NOTIFY:
            case Request.SUBSCRIBE:
                procUtils.sendResponse(Response.METHOD_NOT_ALLOWED)
                break
            case Request.REGISTER:
                if (routeInfo.getRoutingType() === RoutingType.UNKNOWN) {
                    new RegistryHandler(this.sipProvider).doProcess(request)
                    break
                }
                new RegisterHandler(this.dataAPIs).doProcess(serverTransaction)
                break
            case Request.CANCEL:
                new CancelHandler().doProcess(serverTransaction)
                break
            default:
                new RequestHandler(this.sipProvider, this.contextStorage)
                    .doProcess(serverTransaction, request, routeInfo)
        }
    }

    allowedAccess(event, routeInfo) {
        const request = event.getRequest()
        const remoteIp = event.getRemoteIpAddress()

        if (globalACL) {
            if (new AclUtil(globalACL).isIpAllowed(remoteIp) === false) {
                return false
            }
        }

        if (routeInfo.getRoutingType().equals(RoutingType.INTRA_DOMAIN_ROUTING)) {
            const addressOfRecord = request.getRequestURI()
            const response = this.domainsAPI.getDomainByUri(addressOfRecord.getHost())
            if (response.status === Status.OK) {
                const acl = response.data.spec.context.accessControlList
                if (acl) {
                    return new AclUtil(acl).isIpAllowed(remoteIp)
                }
            }
        }
        return true
    }

}

module.exports = RequestProcessor
