/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/resources/utils.js')
load('mod/resources/status.js')
load('mod/resources/agents_api.js')
load('mod/resources/dids_api.js')
load('mod/resources/gateways_api.js')
load('mod/utils/obj_util.js')

var DomainsAPI = (() => {
    const self = this
    const rUtil = new ResourcesUtil()
    const resourcePath = 'config/domains.yml'
    const schemaPath = 'mod/resources/schemas/domains_schema.json'
    const sipFactory = Packages.javax.sip.SipFactory.getInstance()
    const addressFactory = sipFactory.createAddressFactory()

    self.getDomains = (filter) => rUtil.getObjs(resourcePath, filter)

    self.getDomain = (domainUri) => {
        const resource = rUtil.getJson(resourcePath)
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

    self.getRouteForAOR = (addressOfRecord) => {
        let result = self.getDomains()

        if (result.status == Status.OK) {
            const domains = result.obj

            for (var domain of domains) {
                if (isEmpty(domain.spec.context.egressPolicy)) continue

                // Get DID and GW info
                result = DIDsAPI.getInstance().getDID(domain.spec.context.egressPolicy.didRef)
                if (result.status != Status.OK) break
                const did = result.obj
                result = GatewaysAPI.getInstance().getGateway(did.metadata.gwRef)
                if (result.status != Status.OK) break
                const gw = result.obj
                const gwHost = gw.spec.regService.host
                const gwUsername = gw.spec.regService.credentials.username
                const egressRule = domain.spec.context.egressPolicy.rule

                const pattern = 'sip:' + egressRule + '@' + domain.spec.context.domainUri

                if (!new RegExp(pattern).test(addressOfRecord.toString())) continue

                const contactURI = addressFactory.createSipURI(addressOfRecord.getUser(), gwHost)
                contactURI.setSecure(addressOfRecord.isSecure())

                const route = {
                    isLinkAOR: false,
                    thruGW: true,
                    rule: egressRule,
                    gwUsername: gwUsername,
                    gwHost: gwHost,
                    did: did.spec.location.telUrl,
                    contactURI: contactURI
                }

                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    obj: route
                }
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    self.domainExist = domainUri => {
        const result = self.getDomain(domainUri)
        if (result.status == Status.OK) return true
        return false
    }

    self.createDomain = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    self.updateDomain = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    self.deleteDomain = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    self.domainHasUser = (domainUri, username) => {
        const result = AgentsAPI.getInstance().getAgent(domainUri, username)
        if (result.status == Status.OK) return true
        return false
    }

    function _getInstance() {
        if (!rUtil.isResourceValid(schemaPath, resourcePath)) {
            throw "Invalid 'config/domains.yml' resource. Server unable to continue..."
        }

        return self
    }

    return {
        getInstance: _getInstance
    }
})()