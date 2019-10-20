/**
 * @author Pedro Sanders
 * @since v1
 */
const DSUtils = require('@routr/data_api/utils')
const FilesUtil = require('@routr/utils/files_util')

const InetAddress = Java.type('java.net.InetAddress')
const File = Java.type('java.io.File')
const System = Java.type('java.lang.System')
const UUID = Java.type('java.util.UUID')

let config = loadConfig()

module.exports = () => config
module.exports.reloadConfig = () => config = loadConfig()

function loadConfig() {
    const config = getConfigFromFile()
    config.salt = getSalt()
    config.spec.securityContext = getDefaultSecContext(config.spec.securityContext)
    const spec = getSysPresets(config.spec)
    config.spec.externAddr = spec.externAddr
    config.spec.localnets = spec.localnets
    config.spec.dataSource = spec.dataSource
    config.spec.registrarIntf = spec.registrarIntf
    config.spec.restService = getRestfulPresets(config.spec.restService)
    config.system = getSystemConfig()

    if (config.spec.registrarIntf === undefined) config.spec.registrarIntf = 'External'
    if (config.spec.bindAddr === undefined) config.spec.bindAddr = '0.0.0.0'
    //if (config.spec.logging === undefined) config.spec.logging = {
    //    traceLevel: '0'
    //}
    if (config.spec.dataSource === undefined) config.spec.dataSource = {
        provider: 'files_data_provider'
    }
    if (config.metadata === undefined) config.metadata = {}
    if (config.metadata.userAgent === undefined) config.metadata.userAgent = `Routr ${config.system.version}`

    return config
}

function getRestfulPresets(rs) {
    const restService = rs === undefined ? {} : rs

    if (restService.keyStore === undefined) {
        restService.keyStore = 'etc/certs/api-cert.jks'
        restService.keyStorePassword = 'changeit'
    }

    if (restService.unsecured === undefined) restService.unsecured = false
    if (restService.trustStore === undefined) restService.trustStore = null
    if (restService.trustStorePassword === undefined) restService.trustStorePassword = null
    if (restService.bindAddr === undefined) restService.bindAddr = '0.0.0.0'
    if (restService.port === undefined) restService.port = 4567
    if (restService.maxThreads === undefined) restService.maxThreads = 200
    if (restService.minThreads === undefined) restService.minThreads = 8
    if (restService.timeOutMillis === undefined) restService.timeOutMillis = 5000

    return restService
}

function getSysPresets(s) {
    const spec = s === undefined ? {} : s

    if (System.getenv('ROUTR_EXTERN_ADDR') !== null) {
        spec.externAddr = System.getenv('ROUTR_EXTERN_ADDR')
    }

    if (System.getenv('ROUTR_LOCALNETS') !== null) {
        spec.localnets = System.getenv('ROUTR_LOCALNETS').split(',')
    }

    if (System.getenv('ROUTR_DS_PROVIDER') !== null) {
        spec.dataSource = {
            provider: System.getenv('ROUTR_DS_PROVIDER')
        }
    }

    if (System.getenv('ROUTR_REGISTRAR_INTF') !== null) {
        spec.registrarIntf = System.getenv('ROUTR_REGISTRAR_INTF')
    }

    return spec
}

function getDefaultSecContext(sc) {
    const securityContext = sc === undefined ? {} : sc

    if (securityContext.client === undefined) {
        securityContext.client = {}
    }

    if (securityContext.client.authType === undefined) {
        securityContext.client.authType = 'Disabled'
    }

    if (securityContext.client.protocols === undefined) {
        securityContext.client.protocols = ['SSLv3', 'TLSv1.2', 'TLSv1.1', 'TLSv1']
    }

    if (securityContext.debugging === undefined) {
        securityContext.debugging = false
    }

    if (securityContext.keyStore === undefined) {
        securityContext.keyStore = 'etc/certs/domains-cert.jks'
    }

    if (securityContext.trustStore === undefined) {
        securityContext.trustStore = 'etc/certs/domains-cert.jks'
    }

    if (securityContext.keyStorePassword === undefined) {
        securityContext.keyStorePassword = 'changeit'
    }

    if (securityContext.trustStorePassword === undefined) {
        securityContext.trustStorePassword = 'changeit'
    }

    if (securityContext.keyStoreType === undefined) {
        securityContext.keyStoreType = 'jks'
    }

    return securityContext
}

function getSystemConfig() {
    const system = {}
    system.version = 'v1.0'
    system.apiVersion = 'v1beta1'
    system.apiPath = `/api/${system.apiVersion}`
    system.env = []
    system.env.push({
        'var': 'ROUTR_JAVA_OPTS',
        'value': System.getenv('ROUTR_JAVA_OPTS')
    })
    system.env.push({
        'var': 'ROUTR_DS_PROVIDER',
        'value': System.getenv('ROUTR_DS_PROVIDER')
    })
    system.env.push({
        'var': 'ROUTR_DS_PARAMETERS',
        'value': System.getenv('ROUTR_DS_PARAMETERS')
    })
    system.env.push({
        'var': 'ROUTR_CONFIG_FILE',
        'value': System.getenv('ROUTR_CONFIG_FILE')
    })
    system.env.push({
        'var': 'ROUTR_SALT',
        'value': System.getenv('ROUTR_SALT')
    })
    system.env.push({
        'var': 'ROUTR_EXTERN_ADDR',
        'value': System.getenv('ROUTR_EXTERN_ADDR')
    })
    system.env.push({
        'var': 'ROUTR_LOCALNETS',
        'value': System.getenv('ROUTR_LOCALNETS')
    })
    system.env.push({
        'var': 'ROUTR_REGISTRAR_INTF',
        'value': System.getenv('ROUTR_REGISTRAR_INTF')
    })
    system.env.push({
        'var': 'ROUTR_JS_ENGINE',
        'value': System.getenv('ROUTR_JS_ENGINE')
    })
    return system
}

function getConfigFromFile() {
    let config
    try {
        if (System.getenv('ROUTR_CONFIG_FILE') !== null) {
            config = DSUtils.convertToJson(FilesUtil.readFile(System.getenv('ROUTR_CONFIG_FILE')))
        } else {
            config = DSUtils.convertToJson(FilesUtil.readFile('config/config.yml'))
        }
        return config
    } catch (e) {
        print('Unable to open configuration file')
        System.exit(1)
    }
}

function getSalt() {
    if (System.getenv('ROUTR_SALT') !== null) return System.getenv('ROUTR_SALT')

    const pathToSalt = System.getenv('ROUTR_SALT_FILE') !== null ?
        System.getenv('ROUTR_SALT_FILE') :
        `${System.getProperty('user.dir')}/.routr.salt`

    const f = new File(pathToSalt)

    if (f.exists() && !f.isDirectory()) return FilesUtil.readFile(pathToSalt)

    const genSalt = UUID.randomUUID().toString().replace(/\-/g, '')
    FilesUtil.writeFile(pathToSalt, genSalt)

    return genSalt
}
