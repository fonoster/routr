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

export default function (didsAPI, salt) {

    before("/dids",  (req, res) => parameterAuthFilter(req, res, salt))

    before("/dids/*",  (request, response) => parameterAuthFilter(req, res, salt))

    post('/dids', (req, res) => {
        const data = JSON.parse(req.body())
        let response = didsAPI.createFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    get('/dids', (req, res) => {
        let filter = ''

        if(!isEmpty(req.queryParams("filter"))) {
            filter = req.queryParams("filter")
        }

        const response = didsAPI.getDIDs(filter)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    get('/dids/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = didsAPI.getDID(ref)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    put('/dids/:ref', (req, res) => {
        const data = JSON.parse(req.body())
        const response = didsAPI.updateFromJSON(data)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

    del('/dids/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = didsAPI.delete(ref)

        if (response.status && response.status != 200) {
            return JSON.stringify(response)
        }

        return JSON.stringify(response.result)
    })

}