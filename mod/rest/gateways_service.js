/**
 * @author Pedro Sanders
 * @since v1
 */
import RestUtil from 'rest/utils'
import isEmpty from 'utils/obj_util'

const get = Packages.spark.Spark.get
const post = Packages.spark.Spark.post
const put = Packages.spark.Spark.put
const del = Packages.spark.Spark.delete

export default function (gatewaysAPI) {

    post('/gateways', (req, res) => RestUtil.createFromFile(req, gatewaysAPI))

    get('/gateways', (req, res) => {
        let filter = ''
        if(!isEmpty(req.queryParams('filter'))) filter = req.queryParams('filter')
        const response = gatewaysAPI.getGateways(filter)
        return JSON.stringify(response)
    })

    get('/gateways/:ref', (req, res) => JSON.stringify(gatewaysAPI.getGateway(req.params(':ref'))))

    put('/gateways/:ref', (req, res) => {
        const ref = req.params(':ref')
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = ref
        const response = gatewaysAPI.updateFromJSON(jsonObj)
        return JSON.stringify(response)
    })

    del('/gateways/:ref', (req, es) => JSON.stringify(gatewaysAPI.deleteGateway(req.params(':ref'))))

}
