/**
 * @author Pedro Sanders
 * @since v1
 */
import { RouteEntityType } from 'core/route_entity_type'
import { RoutingType } from 'core/routing_type'
import getConfig from 'core/config_util'

const ToHeader = Packages.javax.sip.header.ToHeader
const FromHeader = Packages.javax.sip.header.FromHeader
const StringUtils = Packages.org.apache.commons.lang3.StringUtils

export default class RoutingInfo {

    constructor(request, dataAPIs) {
        const fromHeader = request.getHeader(FromHeader.NAME)
        const toHeader = request.getHeader(ToHeader.NAME)
        const sipFactory = Packages.javax.sip.SipFactory.getInstance()
        this.config = getConfig()
        this.addressFactory = sipFactory.createAddressFactory()
        this.request = request
        this._callerUser = fromHeader.getAddress().getURI().getUser()
        this._callerHost = fromHeader.getAddress().getURI().getHost()
        this._calleeUser = toHeader.getAddress().getURI().getUser()
        this._calleeHost = toHeader.getAddress().getURI().getHost()

        // Overwrites callee info if addressInfo is present
        if(!!this.config.spec.addressInfo) {
            const callee = getCalleeFromAddressInfo(request, this.config.spec.addressInfo)
            this._calleeUser = callee.user
            this._calleeHost = callee.host
        }

        this.peersAPI = dataAPIs.PeersAPI
        this.domainsAPI = dataAPIs.DomainsAPI
        this.didsAPI = dataAPIs.DIDsAPI
        this.agentsAPI = dataAPIs.AgentsAPI
    }


    getCalleeFromAddressInfo(request, addressInfo) {
        const callee = {}
        for (let x in addressInfo) {
            let info = addressInfo[x]
            if (!!request.getHeader(info)) {
                let v = request.getHeader(info).getValue()
                if (/sips?:.*@.*/.test(v)) {
                    const calleeURI = this.addressFactory.createURI(v)
                    callee.user = calleeURI.getUser()
                    callee.host = calleeURI.getHost()
                    break
                }
                LOG.error('Invalid address: ' + v)
            }
        }
        return callee
    }

    getRoutingType() {
        let routingType = RoutingType.UNKNOWN

        if (this.getCallerType() == RouteEntityType.AGENT && this.getCalleeType() == RouteEntityType.AGENT && this.isSameDomain()) routingType = RoutingType.INTRA_DOMAIN_ROUTING
        if (this.getCallerType() == RouteEntityType.AGENT && this.getCalleeType() == RouteEntityType.PEER && this.isSameDomain()) routingType = RoutingType.INTRA_DOMAIN_ROUTING
        if (this.getCallerType() == RouteEntityType.PEER && this.getCalleeType() == RouteEntityType.AGENT && this.isSameDomain()) routingType = RoutingType.INTRA_DOMAIN_ROUTING

        if (this.getCallerType() == RouteEntityType.AGENT && this.getCalleeType() == RouteEntityType.AGENT && !this.isSameDomain()) routingType = RoutingType.INTER_DOMAIN_ROUTING
        if (this.getCallerType() == RouteEntityType.AGENT && this.getCalleeType() == RouteEntityType.PEER && !this.isSameDomain()) routingType = RoutingType.INTER_DOMAIN_ROUTING
        if (this.getCallerType() == RouteEntityType.PEER && this.getCalleeType() == RouteEntityType.AGENT && !this.isSameDomain()) routingType = RoutingType.INTER_DOMAIN_ROUTING

        if (this.getCallerType() == RouteEntityType.AGENT && this.getCalleeType() == RouteEntityType.THRU_GW) routingType = RoutingType.DOMAIN_EGRESS_ROUTING
        if (this.getCallerType() == RouteEntityType.THRU_GW && this.getCalleeType() == RouteEntityType.DID) routingType = RoutingType.DOMAIN_INGRESS_ROUTING

        // This is consider PEER_EGRESS_ROUTING because peers are the only one allow to overwrite the FromHeader.
        if (this.getCallerType() == RouteEntityType.DID && this.getCalleeType() == RouteEntityType.THRU_GW) routingType = RoutingType.PEER_EGRESS_ROUTING
        if (this.getCallerType() == RouteEntityType.PEER && this.getCalleeType() == RouteEntityType.THRU_GW) routingType = RoutingType.PEER_EGRESS_ROUTING

        return routingType
    }

    getRouteEntityType(domain, entity) {
        if (this.peersAPI.peerExist(entity)) {
            return RouteEntityType.PEER
        }

        if (this.agentsAPI.agentExist(domain, entity)) {
            return RouteEntityType.AGENT
        }

        if (StringUtils.isNumeric(this.callerUser)) {
            const telUrl = this.addressFactory.createTelURL(entity)
            if (this.didsAPI.didExist(telUrl)) {
                return RouteEntityType.DID
            }
        }

        if (this.agentsAPI.agentExist(domain, entity)) {
            return RouteEntityType.AGENT
        }

        return RouteEntityType.THRU_GW
    }

    getCallerType () {
        return this.getRouteEntityType(this.callerDomain, this.callerUser)
    }

    getCalleeType() {
        return this.getRouteEntityType(this.calleeDomain, this.calleeUser)
    }

    isSameDomain() {
        return this.callerDomain.equals(this.calleeDomain)
    }

    get callerUser() {
        return this._callerUser
    }

    get callerDomain() {
        return this._callerHost
    }

    get calleeUser() {
        return this._calleeUser
    }

    get calleeDomain() {
        return this._calleeHost
    }
}
