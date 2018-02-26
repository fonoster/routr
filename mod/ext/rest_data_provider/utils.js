/**
 * @author Pedro Sanders
 * @since v1
 */
import getConfig from 'core/config_util'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

const Unirest = Packages.com.mashape.unirest.http.Unirest

export default class DSUtil {

    constructor() {
        const config = getConfig()
        this.resources = config.spec.services.resources
    }

    getWithAuth(path) {
        const r = Unirest.get(this.resources.baseUrl + path)
            .basicAuth(this.resources.credentials.username, this.resources.credentials.secret).asJson()
        return JSON.parse(r.getBody())
    }

    postWithAuth(path) {
        const r = Unirest.post(this.resources.baseUrl + path)
            .basicAuth(this.resources.credentials.username, this.resources.credentials.secret).asJson()
        return JSON.parse(r.getBody())
    }

    getObjs (resource, f) {
        let filter = '*'

        if (!isEmpty(f)) {
            filter = f
        }

        try {
            const encodeFilter = java.net.URLEncoder.encode(filter)
            const result = this.getWithAuth('/' + resource + '?filter=' + encodeFilter)

            if (result.status && result.status != 200) {
                return {
                    status: result.status,
                    message: result.message
                }
            }

            if (!isEmpty(result)) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    obj: result
                }
            }
        } catch(e) {
            e.printStackTrace()

            return {
                status: Status.BAD_REQUEST,
                message: e.getMessage()
            }
        }
    }
}