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

    before("/gateways",  (request, response) => parameterAuthFilter(request, response, salt))

    before("/gateways/*",  (request, response) => parameterAuthFilter(request, response, salt))

    post('/gateways', (request, response) => {
        const data = JSON.parse(request.body())
        let result = gatewaysAPI.createFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/gateways', (request, response) => {
        let filter = ''

        if(!isEmpty(request.queryParams("filter"))) {
            filter = request.queryParams("filter")
        }

        const result = gatewaysAPI.getGateways(filter)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/gateways/:ref', (request, response) => {
        const username = request.params(":username")
        const result = peersAPI.getPeer(username)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    put('/gateways/:ref', (request, response) => {
        const data = JSON.parse(request.body())
        let result = result = gatewaysAPI.updateFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    del('/gateways/:ref', (request, response) => {
        const ref = request.params(":ref")
        let result = result = gatewaysAPI.deleteGateway(ref)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

}