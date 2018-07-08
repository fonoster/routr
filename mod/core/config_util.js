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
    const spec = getSysPresets(config.spec)
    config.spec.externAddr = spec.externAddr
    config.spec.localnets = spec.localnets
    config.spec.dataSource = spec.dataSource
    config.spec.registrarIntf = spec.registrarIntf
    config.spec.restService = getRestfulPresets(config.spec.restService)
    config.system = getSystemConfig()

    if (config.spec.registrarIntf == undefined) {
        config.spec.registrarIntf = 'External'
    }

    if (config.spec.useToAsAOR == undefined) {
        config.spec.useToAsAOR = false
    }

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
        config.metadata.userAgent = 'Arke ' + config.system.version
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

function getSysPresets(s) {
    const spec = s == undefined ? {} : s

    if (System.getenv("ARKE_EXTERN_ADDR") != null) {
        spec.externAddr = Packages.java.lang.System.getenv("ARKE_EXTERN_ADDR")
    }

    if (System.getenv("ARKE_LOCALNETS") != null) {
        spec.localnets = Packages.java.lang.System.getenv("ARKE_LOCALNETS").split(",")
    }

    if (System.getenv("ARKE_DS_PROVIDER") != null) {
        spec.dataSource = { provider : System.getenv("ARKE_DS_PROVIDER") }
    }

    if (System.getenv("ARKE_REGISTRAR_INTF") != null) {
        spec.registrarIntf = System.getenv("ARKE_REGISTRAR_INTF")
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
    system.apiVersion = 'v1beta1'
    system.apiPath = '/api' + '/' + system.apiVersion
    system.env = []
    system.env.push({"var":'ARKE_JAVA_OPTS', "value":System.getenv("ARKE_JAVA_OPTS")})
    system.env.push({"var":'ARKE_DS_PROVIDER', "value":System.getenv("ARKE_DS_PROVIDER")})
    system.env.push({"var":'ARKE_DS_PARAMETERS', "value":System.getenv("ARKE_DS_PARAMETERS")})
    system.env.push({"var":'ARKE_CONFIG_PATH', "value":System.getenv("ARKE_CONFIG_PATH")})
    system.env.push({"var":'ARKE_SALT', "value":System.getenv("ARKE_SALT")})
    system.env.push({"var":'ARKE_EXTERN_ADDR', "value":System.getenv("ARKE_EXTERN_ADDR")})
    system.env.push({"var":'ARKE_LOCALNETS', "value":System.getenv("ARKE_LOCALNETS")})
    system.env.push({"var":'ARKE_REGISTRAR_INTF', "value":System.getenv("ARKE_REGISTRAR_INTF")})
    return system
}

function getConfigFromFile() {
    let config
    try {
        if (System.getenv("ARKE_CONFIG_FILE") != null) {
            config = DSUtil.convertToJson(FilesUtil.readFile(System.getenv("ARKE_CONFIG_FILE")))
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
    if (System.getenv("ARKE_SALT") != null) {
        return System.getenv("ARKE_SALT")
    } else {
        const pathToSalt = System.getProperty("user.home") + "/.arke.salt"
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
