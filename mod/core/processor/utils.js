/**
 * @author Pedro Sanders
 * @since v1
 */

 export default class ProcessorUtils {

   /**
    * Discover DIDs sent via a non-standard header
    * The header must be added at config.spec.addressInfo[*]
    * If the such header is present then overwrite the AOR
    */
   static getAOR (request) {
       for (let x in this.config.spec.addressInfo) {
           let info = this.config.spec.addressInfo[x]
           if (!!request.getHeader(info)) {
               let v = request.getHeader(info).getValue()
               if (/sips?:.*@.*/.test(v) || /tel:\d+/.test(v)) {
                   return this.addressFactory.createURI(v)
               }
               LOG.error('Invalid address: ' + v)
           }
       }
       return request.getHeader(ToHeader.NAME).getAddress().getURI()
   }

}
