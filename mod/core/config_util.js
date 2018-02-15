/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
const InetAddress = Packages.java.net.InetAddress

export default function () {
    const config = new ResourcesUtil().getJson('config/config.yml')

    if (Packages.java.lang.System.getenv("EXTERN_ADDR") != null)
        config.spec.externAddr = Packages.java.lang.System.getenv("EXTERN_ADDR")

    if (Packages.java.lang.System.getenv("LOCALNETS") != null)
        config.spec.localnets = Packages.java.lang.System.getenv("LOCALNETS").split(",")

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
    if (config.metadata.userAgent == undefined) config.metadata.userAgent = 'Sip I/O v1.0'

    if (config.logging == undefined) {
        config.logging = {}
        config.logging.traceLevel = 0
    }

    return config
}
