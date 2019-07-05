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
    const resBase = ('/' + resource + 's').toLowerCase()
    const resByRef = resBase + '/:ref'

    post(resBase, (req, res) => JSON.stringify(RestUtil.createFromFile(req, api)))

    get(resBase, (req, res) => {
        let filter = '@'
        if (!isEmpty(req.queryParams('filter'))) filter = req.queryParams('filter')
        return JSON.stringify(api['get' + resource + 's'](filter))
    })

    get(resByRef, (req, res) => JSON.stringify(api['get' + resource](req.params(':ref'))))

    put(resByRef, (req, res) => {
        const jsonObj = JSON.parse(req.body())
        jsonObj.metadata.ref = req.params(':ref')
        return JSON.stringify(api.updateFromJSON(jsonObj))
    })

    del(resByRef, (req, res) => JSON.stringify(api['delete' + resource](req.params(':ref'))))
}