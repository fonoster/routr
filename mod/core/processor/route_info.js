/**
 * @author Pedro Sanders
 * @since v1
 */
import { SIPEntityType } from 'core/sip_entity_type'
import { RoutingType } from 'core/routing_type'

const ToHeader = Packages.javax.sip.header.ToHeader
const FromHeader = Packages.javax.sip.header.FromHeader
const StringUtils = Packages.org.apache.commons.lang3.StringUtils

export default class RoutingInfo {

    constructor(request, dataAPIs) {
        const fromHeader = request.getHeader(FromHeader.NAME)
        const toHeader = request.getHeader(ToHeader.NAME)
        const sipFactory = Packages.javax.sip.SipFactory.getInstance()
        this.addressFactory = sipFactory.createAddressFactory()
        this.request = request
        this._callerUser = fromHeader.getAddress().getURI().getUser()
        this._callerHost = fromHeader.getAddress().getURI().getHost()
        this._calleeUser = toHeader.getAddress().getURI().getUser()
        this._calleeHost = toHeader.getAddress().getURI().getHost()
        this.peersAPI = dataAPIs.PeersAPI
        this.domainsAPI = dataAPIs.DomainsAPI
        this.didsAPI = dataAPIs.DIDsAPI
        this.agentsAPI = dataAPIs.AgentsAPI
    }

    getRoutingType() {
        if (this.getCallerType() == 'AGENT' && this.getCalleeType() == 'AGENT' && this.isSameDomain()) return RoutingType.INTRA_DOMAIN_ROUTING
        if (this.getCallerType() == 'AGENT' && this.getCalleeType() == 'PEER' && this.isSameDomain()) return RoutingType.INTRA_DOMAIN_ROUTING
        if (this.getCallerType() == 'PEER' && this.getCalleeType() == 'AGENT' && this.isSameDomain()) return RoutingType.INTRA_DOMAIN_ROUTING

        if (this.getCallerType() == 'AGENT' && this.getCalleeType() == 'AGENT' && !this.isSameDomain()) return RoutingType.INTER_DOMAIN_ROUTING
        if (this.getCallerType() == 'AGENT' && this.getCalleeType() == 'PEER' && !this.isSameDomain()) return RoutingType.INTER_DOMAIN_ROUTING
        if (this.getCallerType() == 'PEER' && this.getCalleeType() == 'AGENT' && !this.isSameDomain()) return RoutingType.INTER_DOMAIN_ROUTING

        if (this.getCallerType() == 'AGENT' && this.getCalleeType() == 'THRU_GW') return RoutingType.DOMAIN_EGRESS_ROUTING
        // We could test for SIPEntityType == DID
        if (this.getCallerType() == 'THRU_GW' && this.getCalleeType() == 'THRU_GW') return RoutingType.DOMAIN_INGRESS_ROUTING
        if (this.getCallerType() == 'PEER' && this.getCalleeType() == 'THRU_GW') return RoutingType.PEER_EGRESS_ROUTING
        if (this.getCallerType() == 'PEER' && this.getCalleeType() == 'THRU_GW') return RoutingType.PEER_EGRESS_ROUTING
    }

    getCallerType () {
        if (this.peersAPI.peerExist(this.callerUser)) return SIPEntityType.PEER
        if (this.agentsAPI.agentExist(this.callerDomain, this.callerUser)) return SIPEntityType.AGENT
        return SIPEntityType.THRU_GW
    }

    getCalleeType() {
        if (this.peersAPI.peerExist(this.calleeUser)) return SIPEntityType.PEER
        if (this.agentsAPI.agentExist( this.calleeDomain, this.calleeUser)) return SIPEntityType.AGENT
        return SIPEntityType.THRU_GW
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
