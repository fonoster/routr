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
const RestUtil = require('@routr/rest/utils')
const getJWTToken = require('@routr/rest/jwt_token_generator')
const Location = require('@routr/rest/location_service')
const parameterAuthFilter = require('@routr/rest/parameter_auth_filter')
const basicAuthFilter = require('@routr/rest/basic_auth_filter')
const GRPCClient = Java.type('io.routr.core.GRPCClient')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

const { Status } = require('@routr/core/status')
const moment = require('moment')

getToken = (req, res) =>
  JSON.stringify(
    CoreUtils.buildResponse(Status.OK, null, getJWTToken(req, res, config.salt))
  )

getCredentials = (req, res) => getJWTToken(req, res, config.salt)

checkAuth = (req, res) =>
  basicAuthFilter(req, res, new UsersAPI(DSSelector.getDS()))

checkToken = (req, res) => parameterAuthFilter(req, res, config.salt)

// Its always running! Use to ping Routr server
getSystemStatus = () => JSON.stringify(CoreUtils.buildResponse(Status.OK, 'up'))

postSystemStatus = (req, res) => {
  const status = req.params(':status')

  LOG.debug(JSON.stringify(config))
  LOG.debug('XXXXXX status: ' + status)

  const grpcClient = new GRPCClient(
    'localhost',
    parseInt(config.spec.grpcService.port)
  )

  if (status !== 'down' && status !== 'restarting') {
    res.status(400)
    return '{"status": "400", "message":"Bad Request"}'
  }

  const c = status === 'down' ? 'stop-server' : 'restart-server'
  const cmd = req.queryParams('now') === 'true' ? `${c}-now` : c

  grpcClient.run(cmd)
  res.status(200)

  return '{"status": "200", "message":"Request sent to server"}'
}

getSystemLogs = () => {
  const home = System.getenv('DATA') || '.'
  return JSON.stringify(
    CoreUtils.buildResponse(
      Status.OK,
      null,
      FilesUtil.readFile(`${home}/logs/routr.log`)
    )
  )
}

getSystemInfo = () =>
  JSON.stringify(CoreUtils.buildResponse(Status.OK, null, config.system))

getSystemConfig = () => {
  const result = CoreUtils.buildResponse(Status.OK, null, config)
  // Clonning obj
  const r = JSON.parse(JSON.stringify(result))
  delete r.data.system
  delete r.data.salt
  return JSON.stringify(r)
}

putSystemConfig = req => {
  const configApi = new ConfigAPI(DSSelector.getDS())
  const c = JSON.parse(req.body())
  return JSON.stringify(configApi.setConfig(c))
}

getRegistry = req => {
  const store = new StoreAPI(SDSelector.getDriver())
  const items = store
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
}

getLocation = req => {
  const store = new StoreAPI(SDSelector.getDriver())
  const grpcClient = new GRPCClient(
    'localhost',
    parseInt(config.spec.grpcService.port)
  )
  return Location(store, grpcClient).getLocation(req)
}

deleteLocation = (_, res) => {
  const store = new StoreAPI(SDSelector.getDriver())
  const grpcClient = new GRPCClient(
    'localhost',
    parseInt(config.spec.grpcService.port)
  )
  return Location(store, grpcClient).deleteLocation(res)
}

const APIS = {
  DomainsAPI: DomainsAPI,
  AgentsAPI: AgentsAPI,
  GatewaysAPI: GatewaysAPI,
  NumbersAPI: NumbersAPI,
  PeersAPI: PeersAPI
}

postResource = (req, res, resource) => {
  const api = new APIS[`${resource}sAPI`](DSSelector.getDS())
  const result = RestUtil.createFromFile(req, api)
  res.status(result.status)
  return JSON.stringify(result)
}

getResource = (req, res, resource) => {
  const api = new APIS[`${resource}sAPI`](DSSelector.getDS())
  const result = api[`get${resource}`](req.params(':ref'))
  if (result.status === 'OK') result.data = DSUtils.removeWO(result.data)
  return JSON.stringify(result)
}

getResources = (req, res, resource) => {
  const api = new APIS[`${resource}sAPI`](DSSelector.getDS())
  let filter = '@'
  let page = 1
  let itemsPerPage = 30
  if (!isEmpty(req.queryParams('filter'))) filter = req.queryParams('filter')
  if (!isEmpty(req.queryParams('page'))) page = req.queryParams('page')
  if (!isEmpty(req.queryParams('itemsPerPage')))
    itemsPerPage = req.queryParams('itemsPerPage')

  const result = api[`get${resource}s`](filter, page, itemsPerPage)
  result.data = result.data.map(d => DSUtils.removeWO(d))
  res.status(result.status)
  return JSON.stringify(result)
}

delResource = (req, res, resource) => {
  const api = new APIS[`${resource}sAPI`](DSSelector.getDS())
  const result = api[`delete${resource}`](req.params(':ref'))
  res.status(result.status)
  return JSON.stringify(result)
}

putResource = (req, res, resource) => {
  const api = new APIS[`${resource}sAPI`](DSSelector.getDS())
  const jsonObj = JSON.parse(req.body())
  const result = api.updateFromJSON(jsonObj)
  res.status(result.status)
  return JSON.stringify(result)
}

restConfigJson = JSON.stringify({
  ...config.spec.restService,
  apiPath: config.system.apiPath
})
