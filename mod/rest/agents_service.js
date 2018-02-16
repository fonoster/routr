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

    get('/agents/:ref', (request, response) => {
        const ref = request.params(":ref")
        const result = agentsAPI.getAgentByRef(ref)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    put('/agents/:ref', (request, response) => {
        const ref = request.params(":ref")
        const data = JSON.parse(request.body())
        let result = result = agentsAPI.updateFromJSONObj(ref, data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    del('/agents/:ref', (request, response) => {
        const ref = request.params(":ref")
        let result = result = agentsAPI.deleteAgent(ref)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    // TODO: Add endpoint for location (i.e  '/agents/:domain/:username/location')
}