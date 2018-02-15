/**
 * @author Pedro Sanders
 * @since v1
 */
import isEmpty from 'utils/obj_util'
import parameterAuthFilter from 'rest/parameter_auth_filter'

const get = Packages.spark.Spark.get
const post = Packages.spark.Spark.post
const put = Packages.spark.Spark.put
const del = Packages.spark.Spark.delete
const before = Packages.spark.Spark.before

export default function (domainsAPI, salt) {

    before("/domains",  (request, response) => parameterAuthFilter(request, response, salt))

    before("/domains/*",  (request, response) => parameterAuthFilter(request, response, salt))

    post('/domains', (request, response) => {
        const data = JSON.parse(request.body())
        let result = domainsAPI.createFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/domains', (request, response) => {
        let filter = ''

        if(!isEmpty(request.queryParams("filter"))) {
            filter = request.queryParams("filter")
        }

        const result = domainsAPI.getDomains(filter)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/domains/:domainUri', (request, response) => {
        const domainUri = request.params(":domainUri")
        const result = domainsAPI.getDomain(domainUri)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    put('/domains/:domainUri', (request, response) => {
        const data = JSON.parse(request.body())
        let result = result = domainsAPI.updateFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    del('/domains/:domainUri', (request, response) => {
        const domainUri = request.params(":domainUri")
        let result = result = domainsAPI.deleteDomain(domainUri)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

}