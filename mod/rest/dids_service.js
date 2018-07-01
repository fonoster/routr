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

export default function (didsAPI, salt) {

    before("/dids", (req, res) => parameterAuthFilter(req, res, salt))

    before("/dids/*", (req, res) => parameterAuthFilter(req, res, salt))

    post('/dids', (req, res) => {
        return RestUtil.createFromFile(req, didsAPI)
    })

    get('/dids', (req, res) => {
        let filter = ''
        if(!isEmpty(req.queryParams("filter"))) {
            filter = req.queryParams("filter")
        }
        const response = didsAPI.getDIDs(filter)
        return JSON.stringify(response)
    })

    get('/dids/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = didsAPI.getDID(ref)
        return JSON.stringify(response)
    })

    put('/dids/:ref', (req, res) => {
        const ref = req.params(":ref")
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = ref
        const response = didsAPI.updateFromJSON(jsonObj)
        return JSON.stringify(response)
    })

    del('/dids/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = didsAPI.deleteDID(ref)
        return JSON.stringify(response)
    })

}
