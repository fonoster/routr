/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const validator = require('validator')
const CoreUtils = require('@routr/core/utils')
const {
    Status
} = require('@routr/core/status')

const SipFactory = Java.type('javax.sip.SipFactory')
const addressFactory = SipFactory.getInstance().createAddressFactory()
const get = Java.type('spark.Spark').get
const post = Java.type('spark.Spark').post
const del = Java.type('spark.Spark').delete

module.exports = function(nht) {

    /**
     * Expects json with: address, port, user, expires
     */
    post('/location/:aor', (req, res) => {
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

    get('/location', (req, res) => JSON.stringify(
        CoreUtils.buildResponse(Status.OK,
          nht.withCollection('location')
            .list().map(l => JSON.parse(l)))
    ))

    //get('/location', (req, res) => JSON.stringify(CoreUtils.buildResponse(Status.OK, locator.listAsJSON())))

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
    })

    del('/location', (req, res) => {
        locator.evictAll()
        res.status(200)
        res.body('{\"status\": \"200\", \"message\":\"Evicted All!\"}')
        return '{\"status\": \"200\", \"message\":\"Evicted All!\"}'
    })
}
