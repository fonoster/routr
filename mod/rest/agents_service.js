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

    before("/agents",  (req, res) => parameterAuthFilter(req, res, salt))

    before("/agents/*",  (req, res) => parameterAuthFilter(req, res, salt))

    post('/agents', (req, res) => {
        const data = JSON.parse(req.body())
        const response = agentsAPI.createFromJSON(data)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    get('/agents', (req, res) => {
        let filter = ''

        if(!isEmpty(req.queryParams("filter"))) {
            filter = req.queryParams("filter")
        }

        const response = agentsAPI.getAgents(filter)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    get('/agents/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = agentsAPI.getAgentByRef(ref)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    put('/agents/:ref', (req, res) => {
        const ref = req.params(":ref")
        const data = JSON.parse(req.body())
        const response = agentsAPI.updateFromJSON(ref, data)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    del('/agents/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = agentsAPI.deleteAgent(ref)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    // TODO: Add endpoint for location (i.e  '/agents/:domain/:username/location')
}