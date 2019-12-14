/**
 * @author Pedro Sanders
 * @since v1
 */
const RestUtil = require('@routr/rest/utils')
const isEmpty = require('@routr/utils/obj_util')

const get = Java.type('spark.Spark').get
const post = Java.type('spark.Spark').post
const put = Java.type('spark.Spark').put
const del = Java.type('spark.Spark').delete

module.exports = function(api, resource) {
    const resBase = `/${resource}s`.toLowerCase()
    const resByRef = `${resBase}/:ref`

    post(resBase, (req, res) => {
        const result = RestUtil.createFromFile(req, api)
        res.status(result.status)
        return JSON.stringify(result)
    })

    get(resBase, (req, res) => {
        let filter = '@'
        let page = 1
        let itemsPerPage = 30
        if (!isEmpty(req.queryParams('filter'))) filter = req.queryParams('filter')
        if (!isEmpty(req.queryParams('page'))) page = req.queryParams('page')
        if (!isEmpty(req.queryParams('itemsPerPage'))) itemsPerPage = req.queryParams('itemsPerPage')

        const result = api[`get${resource}s`](filter, page, itemsPerPage)
        res.status(result.status)
        return JSON.stringify(result)
    })

    get(resByRef, (req, res) => JSON.stringify(api[`get${resource}`](req.params(':ref'))))

    put(resByRef, (req, res) => {
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = req.params(':ref')
        const result = api.updateFromJSON(jsonObj)
        res.status(result.status)
        return JSON.stringify(result)
    })

    del(resByRef, (req, res) => {
        const result = api[`delete${resource}`](req.params(':ref'))
        res.status(result.status)
        return JSON.stringify(result)
    })
}
