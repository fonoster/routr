/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const UsersAPI = require('@routr/data_api/users_api')
const AgentsAPI = require('@routr/data_api/agents_api')
const DomainsAPI = require('@routr/data_api/domains_api')
const PeersAPI = require('@routr/data_api/peers_api')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const NumbersAPI = require('@routr/data_api/numbers_api')
const DSSelector = require('@routr/data_api/ds_selector')
const SDSelector = require('@routr/data_api/store_driver_selector')
const StoreAPI = require('@routr/data_api/store_api')
const ConfigAPI = require('@routr/data_api/config_api')
const DSUtils = require('@routr/data_api/utils')
const FilesUtil = require('@routr/utils/files_util')
const System = Java.type('java.lang.System')
const isEmpty = require('@routr/utils/obj_util')
const config = require('@routr/core/config_util')()
const { Status } = require('@routr/core/status')
const getJWTToken = require('@routr/rest/jwt_token_generator')
const resourcesService = require('@routr/rest/resources_service')
const locationService = require('@routr/rest/location_service')
const parameterAuthFilter = require('@routr/rest/parameter_auth_filter')
const basicAuthFilter = require('@routr/rest/basic_auth_filter')
const moment = require('moment')

const LogsHandler = Java.type('io.routr.core.LogsHandler')
const GRPCClient = Java.type('io.routr.core.GRPCClient')
const Spark = Java.type('spark.Spark')
const options = Java.type('spark.Spark').options
const get = Java.type('spark.Spark').get
const post = Java.type('spark.Spark').post
const put = Java.type('spark.Spark').put
const before = Java.type('spark.Spark').before
const path = Java.type('spark.Spark').path
const webSocket = Java.type('spark.Spark').webSocket

const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class Rest {
  constructor () {
    this.store = new StoreAPI(SDSelector.getDriver())
    this.grpc = new GRPCClient('localhost', config.spec.grpcService.port)

    LOG.info(
      `Starting Restful service (port: ${
        config.spec.restService.port
      }, apiPath: ${config.system.apiPath})`
    )

    Spark.ipAddress(config.spec.restService.bindAddr)
    Spark.threadPool(
      config.spec.restService.maxThreads,
      config.spec.restService.minThreads,
      config.spec.restService.timeOutMillis
    )

    if (!config.spec.restService.unsecured) {
      Spark.secure(
        config.spec.restService.keyStore,
        config.spec.restService.keyStorePassword,
        config.spec.restService.trustStore,
        config.spec.restService.trustStorePassword
      )
    }

    Spark.port(config.spec.restService.port)

    Spark.initExceptionHandler(e => {
      LOG.fatal(`Unable to start restService: ${e.message}`)
      System.exit(1)
    })

    Spark.exception(Java.type('java.lang.Exception'), (e, req, res) => {
      res.type('application/json')
      if (e.getMessage().equals('UNAUTHORIZED REQUEST')) {
        res.status(401)
        res.body('{"status": "401", "message":"Unauthorized"}')
      } else {
        res.status(500)
        res.body('{"status": "500", "message":"Internal server error"}')
      }
    })
    Spark.notFound((req, res) => {
      res.type('application/json')
      return '{"status": "404", "message":"Not found"}'
    })
  }

  sendCmd (req, res, grpc) {
    const status = req.params(':status')
    if (status !== 'down' && status !== 'restarting') {
      res.status(400)
      return '{"status": "400", "message":"Bad Request"}'
    }

    const c = status === 'down' ? 'stop-server' : 'restart-server'
    const cmd = req.queryParams('now') === 'true' ? `${c}-now` : c
    grpc.run(cmd)
    res.status(200)
    return '{"status": "200", "message":"Request sent to server"}'
  }

  start () {
    const ds = DSSelector.getDS()
    const configApi = new ConfigAPI(ds)

    // Warning: Experimental
    webSocket(config.system.apiPath + '/system/logs-ws', LogsHandler)

    options('/*', (req, res) => {
      const accessControlRequestHeaders = req.headers(
        'Access-Control-Request-Headers'
      )
      if (accessControlRequestHeaders !== null) {
        res.header('Access-Control-Allow-Headers', accessControlRequestHeaders)
      }

      const accessControlRequestMethod = req.headers(
        'Access-Control-Request-Method'
      )
      if (accessControlRequestMethod !== null) {
        res.header('Access-Control-Allow-Methods', accessControlRequestMethod)
      }
      return 'OK'
    })

    path(config.system.apiPath, r => {
      before('/*', (req, res) => {
        res.header('Access-Control-Allow-Origin', '*')
        if (
          req.pathInfo().endsWith('/credentials') ||
          req.pathInfo().endsWith('/token')
        ) {
          basicAuthFilter(req, res, new UsersAPI(ds))
        } else {
          parameterAuthFilter(req, res, config.salt)
        }
      })

      // Its always running! Use to ping Routr server
      get('/system/status', (req, res) =>
        JSON.stringify(CoreUtils.buildResponse(Status.OK, 'up'))
      )

      post('/system/status/:status', (req, res) =>
        this.sendCmd(req, res, this.grpc)
      )

      get('/system/logs', (req, res) => {
        const home = System.getenv('ROUTR_DATA') || '.'
        return JSON.stringify(
          CoreUtils.buildResponse(
            Status.OK,
            FilesUtil.readFile(`${home}/logs/routr.log`)
          )
        )
      })

      get('/system/info', (req, res) =>
        JSON.stringify(CoreUtils.buildResponse(Status.OK, config.system))
      )

      get('/system/config', (req, res) => JSON.stringify(configApi.getConfig()))

      put('/system/config', (req, res) => {
        const c = JSON.parse(req.body())
        return JSON.stringify(configApi.setConfig(c))
      })

      // Deprecated
      get('/credentials', (req, res) => getJWTToken(req, res, config.salt))

      get('/token', (req, res) =>
        JSON.stringify(
          CoreUtils.buildResponse(Status.OK, getJWTToken(req, res, config.salt))
        )
      )

      get('/registry', (req, res) => {
        const items = this.store
          .withCollection('registry')
          .values()
          .map(r => {
            const reg = JSON.parse(r)
            reg.regOnFormatted = moment(reg.registeredOn).fromNow()
            return reg
          })

        let page = 1
        let itemsPerPage = 30
        if (!isEmpty(req.queryParams('page'))) page = req.queryParams('page')
        if (!isEmpty(req.queryParams('itemsPerPage')))
          itemsPerPage = req.queryParams('itemsPerPage')

        return JSON.stringify(DSUtils.paginate(items, page, itemsPerPage))
      })

      locationService(this.store, this.grpc)

      resourcesService(new AgentsAPI(ds), 'Agent')
      resourcesService(new PeersAPI(ds), 'Peer')
      resourcesService(new DomainsAPI(ds), 'Domain')
      resourcesService(new GatewaysAPI(ds), 'Gateway')
      resourcesService(new NumbersAPI(ds), 'Number')
    })
  }

  stop () {
    LOG.info('Stopping Restful service')
    Spark.stop()
    this.grpc.shutdown()
  }
}

new Rest().start()
