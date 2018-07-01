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

export default function (domainsAPI, salt) {

    before("/domains", (req, res) => parameterAuthFilter(req, res, salt))

    before("/domains/*", (req, res) => parameterAuthFilter(req, res, salt))

    post('/domains', (req, res) => {
        return RestUtil.createFromFile(req, domainsAPI)
    })

    get('/domains', (req, res) => {
        let filter = ''
        if(!isEmpty(req.queryParams("filter"))) filter = req.queryParams("filter")
        const response = domainsAPI.getDomains(filter)
        return JSON.stringify(response)
    })

    get('/domains/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = domainsAPI.getDomain(ref)
        return JSON.stringify(response)
    })

    put('/domains/:ref', (req, res) => {
        const ref = req.params(":ref")
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = ref
        const response = domainsAPI.updateFromJSON(jsonObj)
        return JSON.stringify(response)
    })

    del('/domains/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = domainsAPI.deleteDomain(ref)
        return JSON.stringify(response)
    })

}
