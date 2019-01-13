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

export default function (peersAPI) {

    post('/peers', (req, res) => RestUtil.createFromFile(req, this.peersAPI))

    get('/peers', (req, res) => {
        let filter = ''
        if(!isEmpty(req.queryParams('filter'))) {
            filter = req.queryParams('filter')
        }
        return JSON.stringify(this.peersAPI.getPeers(filter))
    })

    get('/peers/:ref', (req, res) => JSON.stringify(this.peersAPI.getPeer(req.params(':ref'))))

    put('/peers/:ref', (req, res) => {
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = req.params(':ref')
        return JSON.stringify(this.peersAPI.updateFromJSON(jsonObj))
    })

    del('/peers/:ref', (req, res) => JSON.stringify(this.peersAPI.deletePeer(req.params(':ref'))))
}
