load("mod/core/inmemory_location-service.js")
load("mod/core/registrar.js")
load('mod/core/server.js')
load('mod/core/yaml-converter.js')

let location = new InMemoryLocationService()
let registrar = new RegistrarService(location)
let settings = new YamlToJsonConverter().getJson('config/config.yml')

new Server(settings.port,
    settings.proto,
    location,
    registrar,
    settings.traceLevel).start()
