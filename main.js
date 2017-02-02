load("mod/core/inmemory_location_service.js")
load("mod/core/account_manager_service.js")
load("mod/core/registrar.js")
load('mod/core/server.js')
load('mod/utils/yaml_converter.js')

let settings = new YamlToJsonConverter().getJson('config/config.yml')

// This a an in-memory/in-file service implementation. You may use them as reference to create your own
// implementation. For example you may replace the location service implementation to use a database instead of
// in-memory. Same is true for other services.
let location = new LocationService()
let registrar = new RegistrarService(location)
let accountManager = new AccountManagerService();

let config = {
    "ip": InetAddress.getLocalHost().getHostAddress(),
    "port": settings.port,
    "proto": settings.proto,
    "traceLevel": settings.traceLevel
}

new Server(location, registrar, accountManager, config, getPeersFromConfig, getDIDsFromConfig).start()
