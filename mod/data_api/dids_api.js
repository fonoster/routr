/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_api/utils'
import { Status } from 'data_api/status'
import isEmpty from 'utils/obj_util'

export default class DIDsAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    createFromJSON(jsonObj) {
        const response = this.ds.withCollection('gateways').find("@.metadata.ref=='" + jsonObj.metadata.gwRef + "'")

        if (response.result.length == 0) {
            return {
                status: Status.CONFLICT,
                message: Status.message[4091].value
            }
        }

        return this.didExist(jsonObj.spec.location.telUrl)?
          DSUtil.buildResponse(Status.CONFLICT):this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        const response = this.ds.withCollection('gateways').find("@.metadata.ref=='" + jsonObj.metadata.gwRef + "'")

        if (response.result.length == 0) {
            return {
                status: Status.CONFLICT,
                message: Status.message[4091].value
            }
        }

        return !this.didExist(jsonObj.spec.location.telUrl)?
          DSUtil.buildResponse(Status.NOT_FOUND):this.ds.update(jsonObj)
    }

    getDIDs(filter) {
        return this.ds.withCollection('dids').find(filter)
    }

    getDID(ref) {
        return DSUtil.deepSearch(this.getDIDs().result, "metadata.ref", ref)
    }

    /**
     * note: telUrl maybe a string in form of 'tel:${number}' or
     * a TelURL Object.
     */
    getDIDByTelUrl(telUrl) {
        return DSUtil.deepSearch(this.getDIDs().result, "spec.location.telUrl", telUrl)
    }

    didExist(telUrl) {
        return DSUtil.objExist(this.getDIDByTelUrl(telUrl))
    }

    deleteDID(ref) {
        return this.ds.withCollection('dids').remove(ref)
    }

}
