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
    let config

    try {
        if (System.getenv("SIPIO_CONFIG_PATH") != null) {
            config = DSUtil.convertToJson(FilesUtil.readFile(System.getenv("SIPIO_CONFIG_PATH") + '/config.yml'))
        } else {
            config = DSUtil.convertToJson(FilesUtil.readFile('config/config.yml'))
        }
    } catch(e) {
        print('Unable to open configuration file')
        exit(1)
    }

    // Find or generate SALT
    if (System.getenv("SIPIO_SALT") != null) {
        config.salt = System.getenv("SIPIO_SALT")
    } else {
        const pathToSalt = System.getProperty("user.home") + "/.sipio.salt"
        const f = new File(pathToSalt)

        if(f.exists() && !f.isDirectory()) {
            config.salt = FilesUtil.readFile(pathToSalt)
        } else {
            const genSalt = UUID.randomUUID().toString().replaceAll("-", "")
            FilesUtil.writeFile(pathToSalt, genSalt)
            config.salt = genSalt
        }
    }

    if (System.getenv("SIPIO_EXTERN_ADDR") != null) {
        config.spec.externAddr = Packages.java.lang.System.getenv("SIPIO_EXTERN_ADDR")
    }

    if (System.getenv("SIPIO_LOCALNETS") != null) {
        config.spec.localnets = Packages.java.lang.System.getenv("SIPIO_LOCALNETS").split(",")
    }

    if (config.spec.bindAddr == undefined) {
        config.spec.bindAddr = InetAddress.getLocalHost().getHostAddress()
    }

    if (config.spec.restService == undefined) {
        config.spec.restService = {}
    }

    if (config.spec.restService.keyStore == undefined)
        config.spec.restService.keyStore = 'etc/certs/api-cert.jks'

    if (config.spec.restService.keyStorePassword == undefined)
        config.spec.restService.keyStorePassword = 'changeit'

    if (config.spec.restService.trustStore == undefined)
        config.spec.restService.trustStore = null

    if (config.spec.restService.trustStorePassword == undefined)
        config.spec.restService.trustStorePassword = null

    if (config.spec.restService.bindAddr == undefined)
        config.spec.restService.bindAddr = InetAddress.getLocalHost().getHostAddress()

    if (config.spec.restService.port == undefined)
        config.spec.restService.port = 4567

    if (config.spec.securityContext) {
        if (config.spec.securityContext.client == undefined) config.spec.securityContext.client = {}

        if (config.spec.securityContext.client.authType == undefined) {
            config.spec.securityContext.client.authType = 'Disabled'
        }

        if (config.spec.securityContext.client.protocols == undefined) {
            config.spec.securityContext.client.protocols = ['SSLv3', 'TLSv1.2', 'TLSv1.1', 'TLSv1']
        }
    }

    if (config.logging == undefined) {
        config.logging = {}
        config.logging.traceLevel = 0
    }

    if (!config.spec.dataSource) {
        config.spec.dataSource = {}
        config.spec.dataSource.provider = 'files_data_provider'
        config.spec.dataSource.parameters = {}
    }

    if (System.getenv("SIPIO_DS_PROVIDER") != null) {
        config.spec.dataSource.provider = System.getenv("SIPIO_DS_PROVIDER")
    }

    config.system = {}
    config.system.version = 'v1.0'
    config.system.apiVersion = 'v1draft1'
    config.system.apiPath = '/api' + '/' + config.system.apiVersion
    config.system.env = []
    config.system.env.push({"var":'SIPIO_DS_PROVIDER', "value":System.getenv("SIPIO_DS_PROVIDER")})
    config.system.env.push({"var":'SIPIO_DS_PARAMETERS', "value":System.getenv("SIPIO_DS_PARAMETERS")})
    config.system.env.push({"var":'SIPIO_CONFIG_PATH', "value":System.getenv("SIPIO_CONFIG_PATH")})
    config.system.env.push({"var":'SIPIO_SALT', "value":System.getenv("SIPIO_EXTERN_ADDR")})
    config.system.env.push({"var":'SIPIO_EXTERN_ADDR', "value":System.getenv("SIPIO_EXTERN_ADDR")})
    config.system.env.push({"var":'SIPIO_LOCALNETS', "value":System.getenv("SIPIO_LOCALNETS")})

    if (config.metadata == undefined) config.metadata = {}
    if (config.metadata.userAgent == undefined) config.metadata.userAgent = 'Sip I/O ' + config.system.version

    return config
}
