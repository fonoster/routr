load("mod/core/inmemory_location_service.js")
load("mod/core/account_manager_service.js")
load("mod/core/registrar.js")
load('mod/core/server.js')
load('mod/core/yaml_converter.js')

let location = new LocationService()
let registrar = new RegistrarService(location)
let accountManager = new AccountManagerService();
let settings = new YamlToJsonConverter().getJson('config/config.yml')

let config = {
    "ip": InetAddress.getLocalHost().getHostAddress(),
    "port": settings.port,
    "proto": settings.proto,
    "traceLevel": settings.traceLevel
}

new Server(location, registrar, accountManager, config).start()
