/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/core/resources.js')
load('mod/core/inmemory_location_service.js')
load('mod/core/account_manager_service.js')
load('mod/core/registrar.js')
load('mod/core/server.js')
load('mod/utils/yaml_converter.js')

const resourcesAPI = ResourcesAPI

const location = new LocationService()
const registrar = new RegistrarService(location, resourcesAPI)
const accountManager = new AccountManagerService(resourcesAPI)

new Server(location, registrar, accountManager, resourcesAPI).start()
