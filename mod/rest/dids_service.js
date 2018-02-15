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

    before("/dids",  (request, response) => parameterAuthFilter(request, response, salt))

    before("/dids/*",  (request, response) => parameterAuthFilter(request, response, salt))

    post('/dids', (request, response) => {
        const data = JSON.parse(request.body())
        let result = didsAPI.createFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/dids', (request, response) => {
        let filter = ''

        if(!isEmpty(request.queryParams("filter"))) {
            filter = request.queryParams("filter")
        }

        const result = didsAPI.getDIDs(filter)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    get('/dids/:ref', (request, response) => {
        const ref = request.params(":ref")
        const result = didsAPI.getDID(ref)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    put('/dids/:ref', (request, response) => {
        const data = JSON.parse(request.body())
        let result = result = didsAPI.updateFromJSONObj(data)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

    del('/dids/:ref', (request, response) => {
        const ref = request.params(":ref")
        let result = result = didsAPI.deleteDID(ref)

        if (result.status && result.status != 200) {
            return JSON.stringify(result)
        }

        return JSON.stringify(result.obj)
    })

}