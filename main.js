load("mod/core/inmemory_location_service.js")
load("mod/core/account_manager_service.js")
load("mod/core/registrar.js")
load('mod/core/server.js')
load('mod/core/yaml_converter.js')

let location = new InMemoryLocationService()
let registrar = new RegistrarService(location)
let accountManager = new AccountManagerService();
let settings = new YamlToJsonConverter().getJson('config/config.yml')

let ip = InetAddress.getLocalHost().getHostAddress()
let traceLevel = settings.traceLevel
let port = settings.port
let proto = settings.proto
let config = {ip, port, proto, traceLevel}

new Server(location, registrar, accountManager, config).start()
