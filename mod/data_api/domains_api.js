
/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtil = require('@routr/data_api/utils')
const { Status } = require('@routr/core/status')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')

const foundDependentObjects = { status: Status.CONFLICT, message: Status.message[4092].value }

class DomainsAPI {

    constructor(dataSource) {
        this.ds = dataSource
        this.cache = Caffeine.newBuilder()
          .expireAfterWrite(5, TimeUnit.MINUTES)
          .maximumSize(5000)
          .build();
    }

    createFromJSON(jsonObj) {
        return this.domainExist(jsonObj.spec.context.domainUri)? CoreUtils.buildResponse(Status.CONFLICT) : this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        return !this.domainExist(jsonObj.spec.context.domainUri)? CoreUtils.buildResponse(Status.NOT_FOUND) : this.ds.update(jsonObj)
    }

    getDomains(filter) {
        return this.ds.withCollection('domains').find(filter)
    }

    getDomain(ref) {
        returnthis.ds.withCollection('domains').get(ref)
    }

    getDomainByUri(domainUri) {
        let domain = this.cache.getIfPresent(domainUri)

        if (domain == null) {
            domain = DSUtil.deepSearch(this.getDomains(), "spec.context.domainUri", domainUri)
            this.cache.put(domainUri, domain)
        }

        return domain
    }

    domainExist(domainUri) {
        return DSUtil.objExist(this.getDomainByUri(domainUri))
    }

    deleteDomain(ref) {
        if (this.cache.getIfPresent(ref)) {
          this.cache.invalidate(ref)
        }

        let response = this.getDomain(ref)

        if (response.status != Status.OK) {
            return response
        }

        const domain = response.result

        response = this.ds.withCollection('agents').find("'" + domain.spec.context.domainUri + "' in @.spec.domains")
        const agents = response.result

        return agents.length == 0? this.ds.withCollection('domains').remove(ref) : foundDependentObjects
    }
}

module.exports = DomainsAPI
