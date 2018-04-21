/**
 * @author Pedro Sanders
 * @since v1
 */
import Server from 'core/server'
import Locator from 'location/locator.js'
import Registrar from 'registrar/registrar'
// Default Data Provider (from files)
import UsersAPI from 'data_api/users_api'
import AgentsAPI from 'data_api/agents_api'
import DomainsAPI from 'data_api/domains_api'
import PeersAPI from 'data_api/peers_api'
import GatewaysAPI from 'data_api/gateways_api'
import DIDsAPI from 'data_api/dids_api'
// Data sources
import FilesDataSource from 'data_api/files_datasource'
import RedisDataSource from 'data_api/redis_datasource'
import RestfulDataSource from 'data_api/restful_datasource'
import getConfig from 'core/config_util.js'

// Avoids old log4j and jetty logs
java.lang.System.setProperty("org.eclipse.jetty.LEVEL", "WARN")
org.apache.log4j.BasicConfigurator.configure(new
    org.apache.log4j.varia.NullAppender())

let config = getConfig()
let dataSource

if (config.spec.dataSource.provider == 'files_data_provider') {
    dataSource = new FilesDataSource()
} else if(config.spec.dataSource.provider == 'restful_data_provider') {
    dataSource = new RestfulDataSource()
} else if(config.spec.dataSource.provider == 'redis_data_provider') {
    dataSource = new RedisDataSource()
} else {
    print ('Invalid data source')
    exit(1)
}

const dataAPIs = {
    UsersAPI: new UsersAPI(dataSource),
    AgentsAPI: new AgentsAPI(dataSource),
    DomainsAPI: new DomainsAPI(dataSource),
    DIDsAPI: new DIDsAPI(dataSource),
    GatewaysAPI: new GatewaysAPI(dataSource),
    PeersAPI: new PeersAPI(dataSource)
}

const locator = new Locator(dataAPIs)
const registrar = new Registrar(locator, dataAPIs)
new Server(locator, registrar, dataAPIs).start()
