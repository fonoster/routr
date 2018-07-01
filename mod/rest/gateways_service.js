/**
 * @author Pedro Sanders
 * @since v1
 */
import RestUtil from 'rest/utils'
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
        return RestUtil.createFromFile(req, gatewaysAPI)
    })

    get('/gateways', (req, res) => {
        let filter = ''
        if(!isEmpty(req.queryParams("filter"))) filter = req.queryParams("filter")
        const response = gatewaysAPI.getGateways(filter)
        return JSON.stringify(response)
    })

    get('/gateways/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = gatewaysAPI.getGateway(ref)
        return JSON.stringify(response)
    })

    put('/gateways/:ref', (req, res) => {
        const ref = req.params(":ref")
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = ref
        const response = gatewaysAPI.updateFromJSON(jsonObj)
        return JSON.stringify(response)
    })

    del('/gateways/:ref', (req, es) => {
        const ref = req.params(":ref")
        const response = gatewaysAPI.deleteGateway(ref)
        return JSON.stringify(response)
    })

}
