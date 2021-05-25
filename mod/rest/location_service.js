/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const LocatorUtils = require('@routr/location/utils')
const DSUtils = require('@routr/data_api/utils')
const isEmpty = require('@routr/utils/obj_util')
const postal = require('postal')
const validator = require('validator')
const { Status } = require('@routr/core/status')

const SipFactory = Java.type('javax.sip.SipFactory')
const addressFactory = SipFactory.getInstance().createAddressFactory()
const get = Java.type('spark.Spark').get
const post = Java.type('spark.Spark').post
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

module.exports = function (store, grpc) {
  get('/location', req => {
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
  })

  /**
   * Expects json with: address, port, user, expires
   */
  /*post('/location/:aor', (req, res) => {
        const aor = req.params(':aor')

        try {
            const body = JSON.parse(req.body())

            if (!validator.isIP(body.address) ||
                !validator.isPort(`${body.port}`) ||
                !validator.isInt(`${body.expires}`) ||
                !body.user
            ) throw 'Bad Request'

            const route = {
                isLinkAOR: false,
                thruGw: false,
                sentByAddress: body.address,
                sentByPort: body.port,
                received: body.address,
                rport: body.port,
                contactURI: addressFactory.createSipURI(body.user, `${body.address}:${body.port}`),
                registeredOn: Date.now(),
                expires: body.expires,
                nat: true
            }

            postal.publish({
                channel: 'locator',
                topic: 'endpoint.add',
                data: {
                    addressOfRecord: aor,
                    route: route
                }
            })

            res.status(200)
            res.body('{\"status\": \"200\", \"message\":\"Added location entry.\"}')
            return '{\"status\": \"200\", \"message\":\"Added location entry.\"}'
        } catch (e) {
            res.status(401)
            res.body('{\"status\": \"400\", \"message\":\"Bad Request\"}')
            return '{\"status\": \"400\", \"message\":\"Bad Request\"}'
        }
    })

    del('/location/:aor', (req, res) => {
        const aor = req.params(':aor')

        postal.publish({
            channel: 'locator',
            topic: 'endpoint.remove',
            data: {
                addressOfRecord: aor,
                isWildcard: true
            }
        })

        res.status(200)
        res.body('{\"status\": \"200\", \"message\":\"Location entry evicted.\"}')
        return '{\"status\": \"200\", \"message\":\"Location entry evicted.\"}'
    })*/

  del('/location', (req, res) => {
    grpc.run('evict-all')
    res.status(200)
    res.body('{"status": "200", "message":"Evicted All!"}')
    return '{"status": "200", "message":"Evicted All!"}'
  })
}
