/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
const InetAddress = Packages.java.net.InetAddress

export default function () {
    const config = new ResourcesUtil().getJson('config/config.yml')

    if (config.spec.bindAddr == undefined)
        config.spec.bindAddr = InetAddress.getLocalHost().getHostAddress()

    if (config.spec.services.rest.port == undefined)
        config.spec.services.rest.port = 4567

    if (config.spec.services.rest.bindAddr == undefined)
        config.spec.services.rest.bindAddr = InetAddress.getLocalHost().getHostAddress()

    if (config.spec.securityContext) {
        if (config.spec.securityContext.client == undefined) config.spec.securityContext.client = {}

        if (config.spec.securityContext.client.authType == undefined) {
            config.spec.securityContext.client.authType = 'Disabled'
        }

        if (config.spec.securityContext.client.protocols == undefined) {
            config.spec.securityContext.client.protocols = ['TLSv1.2', 'TLSv1.1', 'TLSv1']
        }
    }

    return config
}
