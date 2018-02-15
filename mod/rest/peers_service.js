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

    before("/peers",  (request, response) => parameterAuthFilter(request, response, salt))

    before("/peers/*",  (request, response) => parameterAuthFilter(request, response, salt))

    post('/peers', (request, response) => {
        const data = JSON.parse(request.body())
        let result = peersAPI.createFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/peers', (request, response) => {
        let filter = ''

        if(!isEmpty(request.queryParams("filter"))) {
            filter = request.queryParams("filter")
        }

        const result = peersAPI.getPeers(filter)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/peers/:username', (request, response) => {
        const username = request.params(":username")
        const result = peersAPI.getPeer(username)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    put('/peers/:username', (request, response) => {
        const data = JSON.parse(request.body())
        let result = result = peersAPI.updateFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    del('/peers/:username', (request, response) => {
        const username = request.params(":username")
        let result = result = peersAPI.deletePeer(username)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    // TODO: Add endpoint for location (i.e  '/peers/:username/location')
}