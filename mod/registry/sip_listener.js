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

const InetAddress = Java.type('java.net.InetAddress')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

/*const reRegister = event => {

  const response = event.getResponse()
  const clientTransaction = event.getClientTransaction()
  const viaHeader = response.getHeader(ViaHeader.NAME)
  const expires = RegistrarUtils.getExpires(response)

  LOG.debug('Routr is behind a NAT. Re-registering using Received and RPort')

  const fromURI = response.getHeader(FromHeader.NAME).getAddress().getURI()
  const gwRef = clientTransaction.getRequest().getHeader('X-Gateway-Ref').value
  return {
    user: fromURI.getUser(),
    gwRef: gwRef,
    fromURI  fromURI.getHost(),
      viaHeader.getTransport().toLowerCase(),
      viaHeader.getReceived(),
      viaHeader.getRPort(),
      expires)
} */

function storeRegistry(registryStore, response) {
    const gwURI = response.getHeader(FromHeader.NAME).getAddress().getURI()
    const reg = {
        username: gwURI.getUser(),
        host: gwURI.getHost(),
        ip: InetAddress.getByName(gwURI.getHost()).getHostAddress(),
        //expires: actualExpires,
        expires: getExpires(response),
        registeredOn: Date.now()
    }

    LOG.debug(`registry.listener.storeRegistry [storing gw -> ${gwURI.toString()}]`)

    registryStore.put(gwURI.toString(), JSON.stringify(reg))
}

function removeRegistry(registryStore, response) {
    const gwURI = response.getHeader(FromHeader.NAME).getAddress().getURI()
    LOG.debug(`registry.listener.removeRegistry [removing gw -> ${gwURI.toString()}]`)
    registryStore.remove(gwURI.toString())
}

module.exports = (sipStack, gatewaysAPI, registryStore) => {
    const SipListener = Java.extend(Java.type('javax.sip.SipListener'))
    return new SipListener({
        processResponse: event => {
            const response = event.getResponse()

            try {
                if (isRegisterOk(response)) {
                    if (isBehindNat(response)) {
                      console.log('TODO: re-reg')
                      return
                    }
                    storeRegistry(registryStore, response)
                } else if (isRegisterNok(response)) {
                    removeRegistry(registryStore, response)
                }

                if(mustAuthenticate(response)) {
                    const gwRef = event.getClientTransaction().getRequest()
                      .getHeader('X-Gateway-Ref').value
                    const r = gatewaysAPI.getGateway(gwRef)
                    handleAuthChallenge(sipStack, event, r.result)
                }
            } catch(e) {
                LOG.error(e)
            }
        }
    })
}
