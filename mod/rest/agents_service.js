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

export default function (agentsAPI, salt) {

    before("/agents",  (request, response) => parameterAuthFilter(request, response, salt))

    before("/agents/*",  (request, response) => parameterAuthFilter(request, response, salt))

    post('/agents', (request, response) => {
        const data = JSON.parse(request.body())
        let result = agentsAPI.createFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/agents', (request, response) => {
        let filter = ''

        if(!isEmpty(request.queryParams("filter"))) {
            filter = request.queryParams("filter")
        }

        const result = agentsAPI.getAgents(filter)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/agents/:domain', (request, response) => {
        const domain = request.params(":domain")
        const result = agentsAPI.getAgentsByDomain(domain)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/agents/:domain/:username', (request, response) => {
        const domain = request.params(":domain")
        const username = request.params(":username")
        const result = agentsAPI.getAgent(domain, username)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    put('/agents/:domain/:username', (request, response) => {
        const data = JSON.parse(request.body())
        let result = result = agentsAPI.updateFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    del('/agents/:domain/:username', (request, response) => {
        const domain = request.params(":domain")
        const username = request.params(":username")
        let result = result = agentsAPI.deleteAgent(domain, username)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    // TODO: Add endpoint for location (i.e  '/agents/:domain/:username/location')
}