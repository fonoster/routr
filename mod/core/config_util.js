/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_provider/utils'
import FilesUtil from 'utils/files_util'
const InetAddress = Packages.java.net.InetAddress
const File = Packages.java.io.File
const System = Packages.java.lang.System
const UUID = Packages.java.util.UUID

export default function () {
    // TODO: Create ENV "SIPIO_CONFIG_PATH" to allow for dynamic change of this parameter
    // FIXME: This should be a try and catch
    const config = DSUtil.convertToJson(FilesUtil.readFile('config/config.yml'))

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
            writeFile(pathToSalt, genSalt)
            config.salt = genSalt
        }
    }

    if (System.getenv("SIPIO_EXTERN_ADDR") != null)
        config.spec.externAddr = Packages.java.lang.System.getenv("SIPIO_EXTERN_ADDR")

    if (System.getenv("SIPIO_LOCALNETS") != null)
        config.spec.localnets = Packages.java.lang.System.getenv("SIPIO_LOCALNETS").split(",")

    if (config.spec.bindAddr == undefined)
        config.spec.bindAddr = InetAddress.getLocalHost().getHostAddress()

    if (config.spec.services == undefined) config.spec.services = {}

    if (config.spec.services.rest == undefined) {
        config.spec.services.rest = {}
        config.spec.services.rest.secure = {}
    }

    if (config.spec.services.rest.secure.keyStore == undefined)
        config.spec.services.rest.secure.keyStore = 'etc/certs/api-cert.jks'

    if (config.spec.services.rest.secure.keyStorePassword == undefined)
        config.spec.services.rest.secure.keyStorePassword = 'changeit'

    if (config.spec.services.rest.secure.trustStore == undefined)
        config.spec.services.rest.secure.trustStore = null

    if (config.spec.services.rest.secure.trustStorePassword == undefined)
        config.spec.services.rest.secure.trustStorePassword = null

    if (config.spec.services.rest.bindAddr == undefined)
        config.spec.services.rest.bindAddr = InetAddress.getLocalHost().getHostAddress()

    if (config.spec.services.rest.port == undefined)
        config.spec.services.rest.port = 4567

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
        config.spec.dataSource.provider = 'default'
        config.spec.dataSource.parameters = {}
        config.spec.dataSource.parameters.path = 'config'
    }

    if (config.spec.dataSource.provider == 'default') {
        if (!config.spec.dataSource.parameters) {
            config.spec.dataSource.parameters = {}
            config.spec.dataSource.parameters.path = 'config'
        }
    }

    if (config.spec.dataSource.provider == 'redis_data_provider') {
        if (!config.spec.dataSource.parameters) {
            config.spec.dataSource.parameters = {}
            config.spec.dataSource.parameters.host = 'localhost'
            config.spec.dataSource.parameters.port = '6379'
            config.spec.dataSource.parameters.secret = ''
        }

        if (!config.spec.dataSource.parameters.host) config.spec.dataSource.parameters.host = 'localhost'
        if (!config.spec.dataSource.parameters.port) config.spec.dataSource.parameters.port = '6379'
        if (!config.spec.dataSource.parameters.secret) config.spec.dataSource.parameters.secret = ''
    }

    config.system = {}
    config.system.version = 'v1.0'
    config.system.apiVersion = 'v1draft1'
    config.system.apiPath = '/api' + '/' + config.system.apiVersion
    config.system.env = []
    config.system.env.push({"var":'SIPIO_SALT', "value":System.getenv("SIPIO_EXTERN_ADDR")})
    config.system.env.push({"var":'SIPIO_EXTERN_ADDR', "value":System.getenv("SIPIO_EXTERN_ADDR")})
    config.system.env.push({"var":'SIPIO_LOCALNETS', "value":System.getenv("SIPIO_LOCALNETS")})

    if (config.metadata == undefined) config.metadata = {}
    if (config.metadata.userAgent == undefined) config.metadata.userAgent = 'Sip I/O ' + config.system.version

    return config
}
