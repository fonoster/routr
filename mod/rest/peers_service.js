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
        const data = JSON.parse(req.body())
        let response = peersAPI.createFromJSONObj(data)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    get('/peers', (req, res) => {
        let filter = ''

        if(!isEmpty(req.queryParams("filter"))) {
            filter = req.queryParams("filter")
        }

        const response = peersAPI.getPeers(filter)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    get('/peers/:username', (req, res) => {
        const username = req.params(":username")
        const response = peersAPI.getPeer(username)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    put('/peers/:username', (req, res) => {
        const data = JSON.parse(req.body())
        const response = peersAPI.updateFromJSONObj(data)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    del('/peers/:username', (req, res) => {
        const username = req.params(":username")
        const response = peersAPI.deletePeer(username)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    // TODO: Add endpoint for location (i.e  '/peers/:username/location')
}