/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_api/utils'
import FilesUtil from 'utils/files_util'
const InetAddress = Packages.java.net.InetAddress
const File = Packages.java.io.File
const System = Packages.java.lang.System
const UUID = Packages.java.util.UUID

export default function () {
    const config = getConfigFromFile()
    config.salt = getSalt()
    config.spec.securityContext = getDefaultSecContext(config.spec.securityContext)
    config.spec.externAddr = getSysPresets().externAddr
    config.spec.localnets = getSysPresets().localnets
    config.spec.dataSource = getSysPresets().dataSource
    config.spec.restService = getRestfulPresets(config.spec.restService)
    config.system = getSystemConfig()

    if (config.spec.bindAddr == undefined) {
        config.spec.bindAddr = InetAddress.getLocalHost().getHostAddress()
    }

    if (config.spec.logging == undefined) {
        config.spec.logging = { traceLevel: 0 }
    }

    if (config.spec.dataSource == undefined) {
        config.spec.dataSource = { provider: 'files_data_provider' }
    }

    if (config.metadata == undefined) {
        config.metadata = {}
    }

    if (config.metadata.userAgent == undefined) {
        config.metadata.userAgent = 'Sip I/O ' + config.system.version
    }

    return config
}

function getRestfulPresets(rs) {
    let restService = rs == undefined ? {} : rs

    if (restService.keyStore == undefined) {
        restService.keyStore = 'etc/certs/api-cert.jks'
        restService.keyStorePassword = 'changeit'
    }

    if (restService.unsecured == undefined) {
        restService.unsecured = false
    }

    if (restService.trustStore == undefined) {
        restService.trustStore = null
    }

    if (restService.trustStorePassword == undefined) {
        restService.trustStorePassword = null
    }

    if (restService.bindAddr == undefined) {
        restService.bindAddr = '0.0.0.0'
    }

    if (restService.port == undefined) {
        restService.port = 4567
    }

    return restService
}

function getSysPresets() {
    const spec = {}

    if (System.getenv("SIPIO_EXTERN_ADDR") != null) {
        spec.externAddr = Packages.java.lang.System.getenv("SIPIO_EXTERN_ADDR")
    }

    if (System.getenv("SIPIO_LOCALNETS") != null) {
        spec.localnets = Packages.java.lang.System.getenv("SIPIO_LOCALNETS").split(",")
    }

    if (System.getenv("SIPIO_DS_PROVIDER") != null) {
        spec.dataSource = { provider : System.getenv("SIPIO_DS_PROVIDER") }
    }
    return spec
}

function getDefaultSecContext(sc) {
    let securityContext
    sc == undefined? securityContext = {} : securityContext = sc

    if (securityContext.client == undefined) {
        securityContext.client = {}
    }

    if (securityContext.client.authType == undefined) {
        securityContext.client.authType = 'Disabled'
    }

    if (securityContext.client.protocols == undefined) {
        securityContext.client.protocols = ['SSLv3', 'TLSv1.2', 'TLSv1.1', 'TLSv1']
    }

    if (securityContext.debugging == undefined) {
        securityContext.debugging = false
    }

    if (securityContext.keyStore == undefined) {
        securityContext.keyStore = 'etc/certs/domains-cert.jks'
    }

    if (securityContext.trustStore == undefined) {
        securityContext.trustStore = 'etc/certs/domains-cert.jks'
    }

    if (securityContext.keyStorePassword == undefined) {
        securityContext.keyStorePassword = 'changeit'
    }

    if (securityContext.trustStorePassword == undefined) {
        securityContext.trustStorePassword = 'changeit'
    }

    if (securityContext.keyStoreType == undefined) {
        securityContext.keyStoreType = 'jks'
    }

    return securityContext
}

function getSystemConfig() {
    const system = {}
    system.version = 'v1.0'
    system.apiVersion = 'v1draft1'
    system.apiPath = '/api' + '/' + system.apiVersion
    system.env = []
    system.env.push({"var":'SIPIO_JAVA_OPTS', "value":System.getenv("SIPIO_JAVA_OPTS")})
    system.env.push({"var":'SIPIO_DS_PROVIDER', "value":System.getenv("SIPIO_DS_PROVIDER")})
    system.env.push({"var":'SIPIO_DS_PARAMETERS', "value":System.getenv("SIPIO_DS_PARAMETERS")})
    system.env.push({"var":'SIPIO_CONFIG_PATH', "value":System.getenv("SIPIO_CONFIG_PATH")})
    system.env.push({"var":'SIPIO_SALT', "value":System.getenv("SIPIO_SALT")})
    system.env.push({"var":'SIPIO_EXTERN_ADDR', "value":System.getenv("SIPIO_EXTERN_ADDR")})
    system.env.push({"var":'SIPIO_LOCALNETS', "value":System.getenv("SIPIO_LOCALNETS")})
    return system
}

function getConfigFromFile() {
    let config
    try {
        if (System.getenv("SIPIO_CONFIG_PATH") != null) {
            config = DSUtil.convertToJson(FilesUtil.readFile(System.getenv("SIPIO_CONFIG_PATH") + '/config.yml'))
        } else {
            config = DSUtil.convertToJson(FilesUtil.readFile('config/config.yml'))
        }
        return config
    } catch(e) {
        print('Unable to open configuration file')
        exit(1)
    }
}

function getSalt() {
    // Find or generate SALT
    if (System.getenv("SIPIO_SALT") != null) {
        return System.getenv("SIPIO_SALT")
    } else {
        const pathToSalt = System.getProperty("user.home") + "/.sipio.salt"
        const f = new File(pathToSalt)

        if(f.exists() && !f.isDirectory()) {
            return FilesUtil.readFile(pathToSalt)
        } else {
            const genSalt = UUID.randomUUID().toString().replaceAll("-", "")
            FilesUtil.writeFile(pathToSalt, genSalt)
            return genSalt
        }
    }
}
