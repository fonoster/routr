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

    before("/domains", (req, res) => parameterAuthFilter(req, res, salt))

    before("/domains/*", (req, res) => parameterAuthFilter(req, res, salt))

    post('/domains', (req, res) => {
        const data = JSON.parse(req.body())
        let response = domainsAPI.createFromJSON(data)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    get('/domains', (req, res) => {
        let filter = ''

        if(!isEmpty(req.queryParams("filter"))) {
            filter = req.queryParams("filter")
        }

        const response = domainsAPI.getDomains(filter)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    get('/domains/:domainUri', (req, res) => {
        const domainUri = req.params(":domainUri")
        const response = domainsAPI.getDomain(domainUri)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    put('/domains/:domainUri', (req, res) => {
        const data = JSON.parse(req.body())
        const response = domainsAPI.updateFromJSON(data)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    del('/domains/:domainUri', (req, res) => {
        const domainUri = req.params(":domainUri")
        const response = domainsAPI.deleteDomain(domainUri)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

}