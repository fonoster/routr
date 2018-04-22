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

export default function (agentsAPI, salt) {

    before("/agents", (req, res) => parameterAuthFilter(req, res, salt))

    before("/agents/*", (req, res) => parameterAuthFilter(req, res, salt))

    post('/agents', (req, res) => {
        try {
        const jsonObj = JSON.parse(req.body())
        const response = agentsAPI.createFromJSON(jsonObj)
        return JSON.stringify(response)
      } catch(e) {
          e.printStackTrace()
      }
    })

    get('/agents', (req, res) => {
        let filter = ''
        if(!isEmpty(req.queryParams("filter"))) filter = req.queryParams("filter")
        const response = agentsAPI.getAgents(filter)
        return JSON.stringify(response)
    })

    get('/agents/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = agentsAPI.getAgent(ref)
        return JSON.stringify(response)
    })

    put('/agents/:ref', (req, res) => {
        const ref = req.params(":ref")
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = ref
        const response = agentsAPI.updateFromJSON(jsonObj)
        return JSON.stringify(response)
    })

    del('/agents/:ref', (req, res) => {
        const ref = req.params(":ref")
        const response = agentsAPI.deleteAgent(ref)
        return JSON.stringify(response)
    })
}
