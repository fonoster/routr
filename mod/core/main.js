/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/core/resources.js')
load('mod/core/inmemory_location_service.js')
load('mod/core/account_manager_service.js')
load('mod/core/registrar.js')
load('mod/core/server.js')

const resourcesAPI = ResourcesAPI

const locationService = new LocationService()
const registrar = new RegistrarService(locationService, resourcesAPI)
const accountManager = new AccountManagerService(resourcesAPI)

new Server(locationService, registrar, accountManager, resourcesAPI).start()
