load("mod/core/inmemory_location_service.js")
load("mod/core/account_manager_service.js")
load("mod/core/registrar.js")
load('mod/core/server.js')
load('mod/core/yaml_converter.js')

let location = new InMemoryLocationService()
let registrar = new RegistrarService(location)
let accountManager = new AccountManagerService();
let settings = new YamlToJsonConverter().getJson('config/config.yml')

new Server(settings.port,
    settings.proto,
    location,
    registrar,
    accountManager,
    settings.traceLevel).start()
