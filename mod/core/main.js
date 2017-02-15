/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/core/inmemory_location_service.js')
load('mod/core/account_manager_service.js')
load('mod/core/registrar.js')
load('mod/core/server.js')
load('mod/utils/yaml_converter.js')

const config = new YamlToJsonConverter().getJson('config/config.yml')

const InetAddress = Packages.java.net.InetAddress
config.ip = InetAddress.getLocalHost().getHostAddress()

const location = new LocationService()
const registrar = new RegistrarService(location)
const accountManager = new AccountManagerService()

new Server(location, registrar, accountManager, config).start()
