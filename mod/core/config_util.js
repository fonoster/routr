/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
const InetAddress = Packages.java.net.InetAddress
const BufferedWriter = Packages.java.io.BufferedWriter
const File = Packages.java.io.File
const Files = Packages.java.nio.file.Files
const FileWriter = Packages.java.io.FileWriter
const Paths = Packages.java.nio.file.Paths
const System = Packages.java.lang.System
const UUID = Packages.java.util.UUID

function readFile (path) {
    const lines = Files.readAllLines(Paths.get(path), Packages.java.nio.charset.StandardCharsets.UTF_8)
    const data = []
    lines.forEach(line => { data.push(line) })
    return data.join('\n')
}

function writeFile(path, text) {
  const file = new File (path)
  const out = new BufferedWriter(new FileWriter(file))
  out.write(text)
  out.close()
}

export default function () {
    const config = new ResourcesUtil().getJson('config/config.yml')

    config.system = {}
    config.system.version = 'v1.0'
    config.system.apiVersion = 'v1draft1'
    config.system.apiPath = '/api' + '/' + config.system.apiVersion

    // Find or generate SALT
    if (System.getenv("SIPIO_SALT") != null) {
        config.salt = System.getenv("SIPIO_SALT")
    } else {
        const pathToSalt = System.getProperty("user.home") + "/.sipio.salt"
        const f = new File(pathToSalt)

        if(f.exists() && !f.isDirectory()) {
            config.salt = readFile(pathToSalt)
        } else {
            const genSalt = UUID.randomUUID().toString().replaceAll("-", "")
            writeFile(pathToSalt, genSalt)
            config.salt = genSalt
        }
    }

    if (Packages.java.lang.System.getenv("SIPIO_EXTERN_ADDR") != null)
        config.spec.externAddr = Packages.java.lang.System.getenv("SIPIO_EXTERN_ADDR")

    if (Packages.java.lang.System.getenv("SIPIO_LOCALNETS") != null)
        config.spec.localnets = Packages.java.lang.System.getenv("SIPIO_LOCALNETS").split(",")

    if (config.spec.bindAddr == undefined)
        config.spec.bindAddr = InetAddress.getLocalHost().getHostAddress()

    if (config.spec.services == undefined) config.spec.services = {}

    if (config.spec.services.rest == undefined) {
        config.spec.services.rest = {}
        config.spec.services.rest.secure = {}
        config.spec.services.rest.credentials = {}
    }

    if (config.spec.services.rest.credentials) {
        config.spec.services.rest.credentials.username = 'admin'
        config.spec.services.rest.credentials.secret = 'admin'
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

    if (config.metadata == undefined) config.metadata = {}
    if (config.metadata.userAgent == undefined) config.metadata.userAgent = 'Sip I/O ' + config.system.version

    if (config.logging == undefined) {
        config.logging = {}
        config.logging.traceLevel = 0
    }

    return config
}
