/**
 * @author Pedro Sanders
 * @since v1
 */
const {
    isRegisterOk,
    isRegisterNok,
    isBehindNat,
    mustAuthenticate,
    handleAuthChallenge,
    getExpires
} = require('@routr/core/processor/response_utils')
const {
    fixPort
} = require('@routr/utils/misc_utils')

const InetAddress = Java.type('java.net.InetAddress')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

function storeRegistry(registryStore, gwRef, gwURI, expires) {
    LOG.debug(`registry.listener.storeRegistry [storing gw -> ${gwURI.toString()}]`)
    const reg = {
        username: gwURI.getUser(),
        host: gwURI.getHost(),
        ip: InetAddress.getByName(gwURI.getHost()).getHostAddress(),
        //expires: actualExpires,
        expires: expires,
        registeredOn: Date.now(),
        gwRef: gwRef,
        gwURI: gwURI.toString()
    }
    registryStore.put(gwURI.toString(), JSON.stringify(reg))
}

function removeRegistry(registryStore, gwURI) {
    LOG.debug(`registry.listener.removeRegistry [removing gw -> ${gwURI.toString()}]`)
    registryStore.remove(gwURI.toString())
}

module.exports = (registry, sipStack, gatewaysAPI) => {
    const SipListener = Java.extend(Java.type('javax.sip.SipListener'))
    const registryStore = new NHTClient('vm://routr')
    return new SipListener({
        processResponse: event => {
            const response = event.getResponse()
            const gwURI = response.getHeader(FromHeader.NAME)
              .getAddress().getURI()
            const gwRef = event.getClientTransaction().getRequest()
                      .getHeader('X-Gateway-Ref').value
            const gateway = gatewaysAPI.getGateway(gwRef).result

            try {
                if (isRegisterOk(response)) {
                    if (isBehindNat(response)) {
                        LOG.debug(`Routr is behind a NAT. Re-registering to '${gwRef}' using Received and RPort`)
                        const viaHeader = response.getHeader(ViaHeader.NAME)
                        const received = viaHeader.getReceived()
                        const rport =  fixPort(viaHeader.getRPort())
                        registry.register(gateway, received, rport)
                        return
                    }
                    storeRegistry(registryStore, gwRef, gwURI,
                      getExpires(response))
                } else if (isRegisterNok(response)) {
                    removeRegistry(registryStore, gwURI)
                }

                if(mustAuthenticate(response)) {
                    handleAuthChallenge(sipStack, event, gateway)
                }
            } catch(e) {
                LOG.error(e)
            }
        }
    })
}
