/**
 * @author Pedro Sanders
 * @since v1
 */
const {
  isRegisterOk,
  isRegisterNok,
  mustAuthenticate,
  handleAuthChallenge,
  getExpires
} = require('@routr/core/processor/processor_utils')
const { fixPort } = require('@routr/utils/misc_utils')

const SDSelector = require('@routr/data_api/store_driver_selector')
const StoreAPI = require('@routr/data_api/store_api')
const InetAddress = Java.type('java.net.InetAddress')
const FromHeader = Java.type('javax.sip.header.FromHeader')
const ContactHeader = Java.type('javax.sip.header.ContactHeader')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

function storeRegistry (store, gwRef, gwURI, expires) {
  LOG.debug(
    `registry.listener.storeRegistry [storing gw -> ${gwURI.toString()}]`
  )
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
  store.withCollection('registry').put(gwURI.toString(), JSON.stringify(reg))
}

function removeRegistry (store, gwURI) {
  LOG.debug(
    `registry.listener.removeRegistry [removing gw -> ${gwURI.toString()}]`
  )
  store.withCollection('registry').remove(gwURI.toString())
}

module.exports = (registry, sipStack, gatewaysAPI) => {
  const SipListener = Java.extend(Java.type('javax.sip.SipListener'))
  const store = new StoreAPI(SDSelector.getDriver())
  return new SipListener({
    processResponse: event => {
      const response = event.getResponse()
      const gwURI = response
        .getHeader(FromHeader.NAME)
        .getAddress()
        .getURI()
      const gwRef = event
        .getClientTransaction()
        .getRequest()
        .getHeader('X-Gateway-Ref').value
      const gateway = gatewaysAPI.getGateway(gwRef).data

      LOG.debug(
        `registry.listener.createSipListener [gwURI: ${gwURI}, gwRef: ${gwRef}]`
      )

      try {
        if (isRegisterOk(response)) {
          LOG.debug(`registry.listener.createSipListener [isRegisterOk: yes]`)
          // BEWARE: This is not being cover by the SEET test. It will always
          // be "behind nat" and registry will no be stored.
          const xReceivedHeader = response.getHeader('X-Inf-Received')
          const xRPortHeader = response.getHeader('X-Inf-RPort')
          const contactHeader = response.getHeader(ContactHeader.NAME)
          const received = contactHeader.getAddress().getHost()
          const rport = fixPort(contactHeader.getAddress().getPort())

          const registerInfo = {
            xReceivedHeader: xReceivedHeader.value,
            xRPortHeader: xRPortHeader.value,
            contactHeader: contactHeader.value,
            received,
            rport
          }

          LOG.debug(
            `registry.listener.createSipListener [registerInfo: ${JSON.stringify(
              registerInfo
            )}]`
          )

          if (
            !xReceivedHeader.value.equals(received) ||
            !xRPortHeader.value.equals(`${rport}`)
          ) {
            LOG.debug(
              `registry.listener.createSipListener [Routr is behind a NAT. Re-registering to '${gwRef}' using Received and RPort]`
            )
            registry.register(
              gateway,
              xReceivedHeader.value,
              xRPortHeader.value
            )
            return
          }
          storeRegistry(store, gwRef, gwURI, getExpires(response))
        } else if (isRegisterNok(response)) {
          LOG.debug(`registry.listener.createSipListener [isRegisterOk: no]`)
          removeRegistry(store, gwURI)
        }

        if (mustAuthenticate(response)) {
          LOG.debug(
            `registry.listener.createSipListener [firing 'handleAuthChallenge' method]`
          )
          handleAuthChallenge(sipStack, event, gateway)
        }
      } catch (e) {
        LOG.error(e)
      }
    }
  })
}
