/**
 * @author Pedro Sanders
 * @since v1
 */
const System = Java.type('java.lang.System')
const BasicConfigurator = Java.type('org.apache.log4j.BasicConfigurator')
const NullAppender = Java.type('org.apache.log4j.varia.NullAppender')
load(System.getProperty('user.dir') + '/libs/jvm-npm.js')

const Server = require('@routr/core/server')
// Default Data Provider (from files)
const UsersAPI = require('@routr/data_api/users_api')
const AgentsAPI = require('@routr/data_api/agents_api')
const DomainsAPI = require('@routr/data_api/domains_api')
const PeersAPI = require('@routr/data_api/peers_api')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const DIDsAPI = require('@routr/data_api/dids_api')

// Data sources
const FilesDataSource = require('@routr/data_api/files_datasource')
const RedisDataSource = require('@routr/data_api/redis_datasource')
const config = require('@routr/core/config_util')()

// XXX: This feals a bit like a hack. But it is ok for now.
var global = {
    timer
}

// Avoids old log4j and jetty logs
System.setProperty("org.eclipse.jetty.LEVEL", "WARN")
BasicConfigurator.configure(new NullAppender())

let dataSource

if (config.spec.dataSource.provider === 'files_data_provider') {
    dataSource = new FilesDataSource()
} else if (config.spec.dataSource.provider === 'redis_data_provider') {
    dataSource = new RedisDataSource()
} else {
    print('Invalid data source')
    System.exit(1)
}

const dataAPIs = {
    UsersAPI: new UsersAPI(dataSource),
    AgentsAPI: new AgentsAPI(dataSource),
    DomainsAPI: new DomainsAPI(dataSource),
    DIDsAPI: new DIDsAPI(dataSource),
    GatewaysAPI: new GatewaysAPI(dataSource),
    PeersAPI: new PeersAPI(dataSource)
}

new Server(dataAPIs).start()
