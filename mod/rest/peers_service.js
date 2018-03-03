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

export default function (peersAPI, salt) {

    before("/peers", (req, res) => parameterAuthFilter(req, res, salt))

    before("/peers/*", (req, res) => parameterAuthFilter(req, res, salt))

    post('/peers', (req, res) => {
        const jsonObj = JSON.parse(req.body())
        let response = peersAPI.createFromJSON(jsonObj)
        return JSON.stringify(response)
    })

    get('/peers', (req, res) => {
        let filter = ''
        if(!isEmpty(req.queryParams("filter"))) {
            filter = req.queryParams("filter")
        }
        const response = peersAPI.getPeers(filter)
        return JSON.stringify(response)
    })

    get('/peers/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = peersAPI.getPeer(ref)
        return JSON.stringify(response)
    })

    put('/peers/:ref', (req, res) => {
        const ref = req.params(":ref")
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = ref
        const response = peersAPI.updateFromJSON(jsonObj)
        return JSON.stringify(response)
    })

    del('/peers/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = peersAPI.deletePeer(ref)
        return JSON.stringify(response)
    })

    // TODO: Add endpoint for location (i.e  '/peers/:ref/location')
}