/**
 * @author Pedro Sanders
 * @since v1
 */
import Locator from 'location/locator.js'
import GatewaysAPI from 'resources/gateways_api'
import PeersAPI from 'resources/peers_api'
import DIDsAPI from 'resources/dids_api'
import DomainsAPI from 'resources/domains_api'
import AgentsAPI from 'resources/agents_api'
import RegistrarService from 'core/registrar'
import Server from 'core/server'

// Just to avoid the annoying old log4j messages
org.apache.log4j.BasicConfigurator.configure(new
    org.apache.log4j.varia.NullAppender())

const dataAPIs = {
    AgentsAPI: new AgentsAPI(),
    DomainsAPI: new DomainsAPI(),
    DIDsAPI: new DIDsAPI(),
    GatewaysAPI: new GatewaysAPI(),
    PeersAPI: new PeersAPI()
}

const locator = new Locator(dataAPIs)
const registrarService = new RegistrarService(locator, dataAPIs)
new Server(locator, registrarService, dataAPIs).start()

