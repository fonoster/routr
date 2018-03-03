/**
 * @author Pedro Sanders
 * @since v1
 */
import Server from 'core/server'
import Locator from 'location/locator.js'
import Registrar from 'registrar/registrar'
// Default Data Provider (from files)
import UsersAPI from 'data_provider/users_api'
import AgentsAPI from 'data_provider/agents_api'
import DomainsAPI from 'data_provider/domains_api'
import PeersAPI from 'data_provider/peers_api'
import GatewaysAPI from 'data_provider/gateways_api'
import DIDsAPI from 'data_provider/dids_api'
// RESTful API Data Provider
import RestUsersAPI from 'ext/rest_data_provider/users_api'
import RestAgentsAPI from 'ext/rest_data_provider/agents_api'
import RestDomainsAPI from 'ext/rest_data_provider/domains_api'
import RestPeersAPI from 'ext/rest_data_provider/peers_api'
import RestGatewaysAPI from 'ext/rest_data_provider/gateways_api'
import RestDIDsAPI from 'ext/rest_data_provider/dids_api'
// Redis Data Provider
import RedisUsersAPI from 'ext/redis_data_provider/users_api'
import RedisAgentsAPI from 'ext/redis_data_provider/agents_api'
import RedisDomainsAPI from 'ext/redis_data_provider/domains_api'
import RedisPeersAPI from 'ext/redis_data_provider/peers_api'
import RedisGatewaysAPI from 'ext/redis_data_provider/gateways_api'
import RedisDIDsAPI from 'ext/redis_data_provider/dids_api'
import getConfig from 'core/config_util.js'

let config = getConfig()

// Avoids old log4j messages
org.apache.log4j.BasicConfigurator.configure(new
    org.apache.log4j.varia.NullAppender())

let dataAPIs

if (config.spec.dataSource.provider == 'default') {
    dataAPIs = {
        UsersAPI: new UsersAPI(),
        AgentsAPI: new AgentsAPI(),
        DomainsAPI: new DomainsAPI(),
        DIDsAPI: new DIDsAPI(),
        GatewaysAPI: new GatewaysAPI(),
        PeersAPI: new PeersAPI()
    }
} else if(config.spec.dataSource.provider == 'rest_data_provider') {
    dataAPIs = {
        UsersAPI: new RestUsersAPI(),
        AgentsAPI: new RestAgentsAPI(),
        DomainsAPI: new RestDomainsAPI(),
        DIDsAPI: new RestDIDsAPI(),
        GatewaysAPI: new RestGatewaysAPI(),
        PeersAPI: new RestPeersAPI()
    }
} else if(config.spec.dataSource.provider == 'redis_data_provider') {
    dataAPIs = {
        UsersAPI: new UsersAPI(),
        DomainsAPI: new RedisDomainsAPI(),
        AgentsAPI: new RedisAgentsAPI(),
        DIDsAPI: new RedisDIDsAPI(),
        GatewaysAPI: new RedisGatewaysAPI(),
        PeersAPI: new RedisPeersAPI()
    }
}else {
    print ('Invalid data source')
    exit(1)
}

const locator = new Locator(dataAPIs)
const registrar = new Registrar(locator, dataAPIs)
new Server(locator, registrar, dataAPIs).start()

