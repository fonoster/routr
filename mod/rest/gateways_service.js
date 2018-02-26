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

export default function (gatewaysAPI, salt) {

    before("/gateways", (req, res) => parameterAuthFilter(req, res, salt))

    before("/gateways/*", (req, res) => parameterAuthFilter(req, res, salt))

    post('/gateways', (req, res) => {
        const data = JSON.parse(req.body())
        let response = gatewaysAPI.createFromJSON(data)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    get('/gateways', (req, res) => {
        let filter = ''

        if(!isEmpty(req.queryParams("filter"))) {
            filter = req.queryParams("filter")
        }

        const response = gatewaysAPI.getGateways(filter)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    get('/gateways/:ref', (req, res) => {
        const username = req.params(":username")
        const response = peersAPI.getPeer(username)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    put('/gateways/:ref', (req, res) => {
        const data = JSON.parse(req.body())
        const response = gatewaysAPI.updateFromJSON(data)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    del('/gateways/:ref', (req, es) => {
        const ref = req.params(":ref")
        const response = gatewaysAPI.delete(ref)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

}