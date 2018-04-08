/**
 * @author Pedro Sanders
 * @since v1
 */
const SipFactory = Packages.javax.sip.SipFactory
const ToHeader = Packages.javax.sip.header.ToHeader

export default class ProcessorUtils {

    constructor(request, serverTransaction, messageFactory) {
        this.request = request
        this.st = serverTransaction
        this.messageFactory = messageFactory
    }

    sendResponse(responseType) {
        this.st.sendResponse(this.messageFactory.createResponse(responseType, this.request))
    }

    /**
      * Discover DIDs sent via a non-standard header
      * The header must be added at config.spec.addressInfo[*]
      * If the such header is present then overwrite the AOR
      */
    static getAOR (request, addressInfo = []) {
      for (const x in addressInfo) {
          let info = addressInfo[x]
          if (request.getHeader(info) != undefined) {
              let v = request.getHeader(info).getValue()
              if (/sips?:.*@.*/.test(v) || /tel:\d+/.test(v)) {
                  const addressFactory = SipFactory.getInstance().createAddressFactory()
                  return addressFactory.createURI(v)
              }
              LOG.error('Invalid address: ' + v)
          }
      }
      return request.getHeader(ToHeader.NAME).getAddress().getURI()
    }
}
