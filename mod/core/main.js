/**
 * @author Pedro Sanders
 * @since v1
 */
import Locator from 'location/locator.js'
import GatewaysAPI from 'resources/gateways_api'
import DIDsAPI from 'resources/dids_api'
import DomainsAPI from 'resources/domains_api'
import UsersAPI from 'resources/users_api'
import AgentsAPI from 'resources/agents_api'
import PeersAPI from 'resources/peers_api'
import Registrar from 'registrar/registrar'
import Server from 'core/server'

// Just to avoid the annoying old log4j messages
org.apache.log4j.BasicConfigurator.configure(new
    org.apache.log4j.varia.NullAppender())

const dataAPIs = {
    UsersAPI: new UsersAPI(),
    AgentsAPI: new AgentsAPI(),
    DomainsAPI: new DomainsAPI(),
    DIDsAPI: new DIDsAPI(),
    GatewaysAPI: new GatewaysAPI(),
    PeersAPI: new PeersAPI()
}

const locator = new Locator(dataAPIs)
const registrar = new Registrar(locator, dataAPIs)
new Server(locator, registrar, dataAPIs).start()

