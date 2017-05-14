/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/core/account_manager_service.js')
load('mod/core/registrar.js')
load('mod/core/server.js')
load('mod/resources/dids_api.js')
load('mod/resources/gateways_api.js')
load('mod/resources/peers_api.js')
load('mod/location/inmemory_location_service.js')
load('mod/resources/domains_api.js')
load('mod/resources/agents_api.js')

const dataAPIs = {
    getAgentsAPI: AgentsAPI.getInstance,
    getDomainsAPI: DomainsAPI.getInstance,
    getDIDsAPI: DIDsAPI.getInstance,
    getGatewaysAPI: GatewaysAPI.getInstance,
    getPeersAPI: PeersAPI.getInstance
}

const locationService = new LocationService(dataAPIs)

const registrarService = new RegistrarService(locationService, dataAPIs)
const accountManager = new AccountManagerService(dataAPIs)

new Server(locationService, registrarService, accountManager, dataAPIs).start()

