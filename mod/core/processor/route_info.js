/**
 * @author Pedro Sanders
 * @since v1
 */
const { RouteEntityType } = require('@routr/core/route_entity_type')
const { RoutingType } = require('@routr/core/routing_type')
const getConfig = require('@routr/core/config_util')

const ToHeader = Packages.javax.sip.header.ToHeader
const FromHeader = Packages.javax.sip.header.FromHeader
const StringUtils = Packages.org.apache.commons.lang3.StringUtils

class RouteInfo {

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
            const callee = this.getCalleeFromAddressInfo(request, this.config.spec.addressInfo)
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
        for (const x in addressInfo) {
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
        const callerType = this.getCallerType()
        const calleetype = this.getCalleeType()
        const belongToSameDomain = this.isSameDomain()

        if (callerType == RouteEntityType.AGENT && calleetype == RouteEntityType.AGENT && belongToSameDomain) routingType = RoutingType.INTRA_DOMAIN_ROUTING
        if (callerType == RouteEntityType.AGENT && calleetype == RouteEntityType.PEER && belongToSameDomain) routingType = RoutingType.INTRA_DOMAIN_ROUTING

        if (callerType == RouteEntityType.AGENT && calleetype == RouteEntityType.AGENT && !belongToSameDomain) routingType = RoutingType.INTER_DOMAIN_ROUTING
        if (callerType == RouteEntityType.AGENT && calleetype == RouteEntityType.PEER && !belongToSameDomain) routingType = RoutingType.INTER_DOMAIN_ROUTING
        if (callerType == RouteEntityType.AGENT && calleetype == RouteEntityType.THRU_GW) routingType = RoutingType.DOMAIN_EGRESS_ROUTING

        if (callerType == RouteEntityType.PEER && calleetype == RouteEntityType.AGENT && !belongToSameDomain) routingType = RoutingType.INTER_DOMAIN_ROUTING
        if (callerType == RouteEntityType.PEER && calleetype == RouteEntityType.AGENT && belongToSameDomain) routingType = RoutingType.INTRA_DOMAIN_ROUTING
        if (callerType == RouteEntityType.PEER && this.getCalleeType() == RouteEntityType.THRU_GW) routingType = RoutingType.PEER_EGRESS_ROUTING

        if (callerType == RouteEntityType.THRU_GW && calleetype == RouteEntityType.DID) routingType = RoutingType.DOMAIN_INGRESS_ROUTING

        // This is consider PEER_EGRESS_ROUTING because peers are the only one allow to overwrite the FromHeader.
        if (callerType == RouteEntityType.DID && this.getCalleeType() == RouteEntityType.THRU_GW) routingType = RoutingType.PEER_EGRESS_ROUTING

        return routingType
    }

    getRouteEntityType(domain, entity) {
        let entityType = RouteEntityType.THRU_GW

        if (this.peersAPI.peerExist(entity)) {
            entityType = RouteEntityType.PEER
        }

        if (this.agentsAPI.agentExist(domain, entity)) {
            entityType = RouteEntityType.AGENT
        }

        if (StringUtils.isNumeric(this.callerUser)) {
            const telUrl = this.addressFactory.createTelURL(entity)
            if (this.didsAPI.didExist(telUrl)) {
                entityType = RouteEntityType.DID
            }
        }

        if (this.agentsAPI.agentExist(domain, entity)) {
            entityType = RouteEntityType.AGENT
        }

        return entityType
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

module.exports = RouteInfo
