/**
 * @author Pedro Sanders
 * @since v1
 */
const LocatorUtils = require('@routr/location/utils')
const DSUtils = require('@routr/data_api/utils')
const isEmpty = require('@routr/utils/obj_util')
const get = Java.type('spark.Spark').get
const del = Java.type('spark.Spark').delete

function routeFromString (routes) {
  let contactInfo = ''

  const rObj = routes.sort((a, b) => a.registeredOn > b.registeredOn)[0]
  let r = `${rObj.contactURI};nat=${rObj.nat};expires=${rObj.expires}`

  if (routes.length > 1) r = `${r} [...]`
  contactInfo = `${contactInfo}${r}`

  return {
    addressOfRecord: rObj.addressOfRecord,
    contactInfo: contactInfo
  }
}

module.exports = function (store, gprc) {
  function getLocation (req, res) {
    const items = store
      .withCollection('location')
      .values()
      .map(e => JSON.parse(e))
      .filter(e => !e[0].isSynth)
      .filter(e => !e[0].thruGw)
      .filter(
        e => e.filter(r => !LocatorUtils.expiredRouteFilter(r)).length > 0
      )
      .map(e => routeFromString(e))

    let page = 1
    let itemsPerPage = 30
    if (!isEmpty(req.queryParams('page'))) page = req.queryParams('page')
    if (!isEmpty(req.queryParams('itemsPerPage')))
      itemsPerPage = req.queryParams('itemsPerPage')

    return JSON.stringify(DSUtils.paginate(items, page, itemsPerPage))
  }

  function deleteLocation (res) {
    grpc.run('evict-all')
    res.status(200)
    res.body('{"status": "200", "message":"Evicted All!"}')
    return '{"status": "200", "message":"Evicted All!"}'
  }

  return {
    getLocation,
    deleteLocation
  }
}
