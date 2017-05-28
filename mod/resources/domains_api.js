/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
import AgentsAPI from 'resources/agents_api'
import DIDsAPI from 'resources/dids_api'
import GatewaysAPI from 'resources/gateways_api'
import { Status } from 'resources/status'
import isEmpty from 'utils/obj_util'

const SipFactory = Packages.javax.sip.SipFactory

export default class DomainsAPI {

    constructor() {
        this.resourcePath = 'config/domains.yml'
        this.schemaPath = 'etc/schemas/domains_schema.json'
        this.rUtil = new ResourcesUtil()
        if (!this.rUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/domains.yml' resource. Server unable to continue..."
        }
        this.addressFactory = SipFactory.getInstance().createAddressFactory()
        this.agensAPI = new AgentsAPI()
        this.gatewaysAPI = new GatewaysAPI()
        this.didsAPI = new DIDsAPI()
    }

    getDomains(filter) {
        return this.rUtil.getObjs(this.resourcePath, filter)
    }

    getDomain(domainUri) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let domain

        resource.forEach(obj => {
            if (obj.spec.context.domainUri == domainUri) {
                domain = obj
            }
        })

        if (!isEmpty(domain)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: domain
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getRouteForAOR(addressOfRecord) {
        if (!(addressOfRecord instanceof Packages.javax.sip.address.SipURI)) throw 'AOR must be instance of javax.sip.address.SipURI'

        const didsAPI = this.didsAPI
        const gatewaysAPI = this.gatewaysAPI
        const addressFactory = this.addressFactory

        let result = this.getDomains()
        let route

        if (result.status == Status.OK) {
            const domains = result.obj

            domains.forEach(domain => {
                if (!isEmpty(domain.spec.context.egressPolicy)) {
                    // Get DID and GW info
                    result = didsAPI.getDID(domain.spec.context.egressPolicy.didRef)

                    if (result.status == Status.OK) {
                        const did = result.obj
                        result = gatewaysAPI.getGateway(did.metadata.gwRef)

                        if (result.status == Status.OK) {
                            const gw = result.obj
                            const gwHost = gw.spec.regService.host
                            const gwUsername = gw.spec.regService.credentials.username
                            const gwRef = gw.metadata.ref
                            const egressRule = domain.spec.context.egressPolicy.rule
                            const pattern = 'sip:' + egressRule + '@' + domain.spec.context.domainUri

                            if (new RegExp(pattern).test(addressOfRecord.toString())) {
                                const contactURI = addressFactory.createSipURI(addressOfRecord.getUser(), gwHost)
                                contactURI.setSecure(addressOfRecord.isSecure())

                                route = {
                                    isLinkAOR: false,
                                    thruGW: true,
                                    rule: egressRule,
                                    gwUsername: gwUsername,
                                    gwRef: gwRef,
                                    gwHost: gwHost,
                                    did: did.spec.location.telUrl.split(':')[1],
                                    contactURI: contactURI
                                }
                            }
                        }
                    }
                }
            })
        }

        if(route) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: route
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    domainExist(domainUri){
        const result = this.getDomain(domainUri)
        if (result.status == Status.OK) return true
        return false
    }

    createDomain() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateDomain() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    deleteDomains() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    domainHasUser(domainUri, username) {
        const result = agentsAPI.getAgent(domainUri, username)
        if (result.status == Status.OK) return true
        return false
    }

    createFromJSONObj() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateFromJSONObj() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }
}