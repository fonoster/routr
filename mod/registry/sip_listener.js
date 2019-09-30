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

const NHTClient = Java.type('io.routr.nht.NHTClient')
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
    registryStore.withCollection('registry').put(gwURI.toString(), JSON.stringify(reg))
}

function removeRegistry(registryStore, gwURI) {
    LOG.debug(`registry.listener.removeRegistry [removing gw -> ${gwURI.toString()}]`)
    registryStore.withCollection('registry').remove(gwURI.toString())
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
                    // BEWARE: This is not being cover by the SEET test. It will always
                    // be "behind nat" and registry will no be stored.
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
