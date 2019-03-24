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

export default function (domainsAPI) {

    post('/domains', (req, res) => RestUtil.createFromFile(req, domainsAPI))

    get('/domains', (req, res) => {
        let filter = ''
        if(!isEmpty(req.queryParams('filter'))) filter = req.queryParams('filter')
        const response = domainsAPI.getDomains(filter)
        return JSON.stringify(response)
    })

    get('/domains/:ref', (req, res) => JSON.stringify(domainsAPI.getDomain(req.params(':ref'))))

    put('/domains/:ref', (req, res) => {
        const ref = req.params(':ref')
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = ref
        const response = domainsAPI.updateFromJSON(jsonObj)
        return JSON.stringify(response)
    })

    del('/domains/:ref', (req, res) => JSON.stringify(domainsAPI.deleteDomain(req.params(':ref'))))

}
