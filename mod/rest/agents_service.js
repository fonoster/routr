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

export default function (agentsAPI) {

    post('/agents', (req, res) => RestUtil.createFromFile(req, agentsAPI))

    get('/agents', (req, res) => {
        let filter = ''
        if(!isEmpty(req.queryParams('filter'))) filter = req.queryParams('filter')
        const response = agentsAPI.getAgents(filter)
        return JSON.stringify(response)
    })

    get('/agents/:ref', (req, res) => JSON.stringify(agentsAPI.getAgent(req.params(':ref'))))

    put('/agents/:ref', (req, res) => {
        const ref = req.params(':ref')
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = ref
        const response = agentsAPI.updateFromJSON(jsonObj)
        return JSON.stringify(response)
    })

    del('/agents/:ref', (req, res) => JSON.stringify(agentsAPI.deleteAgent(req.params(':ref'))))
}
