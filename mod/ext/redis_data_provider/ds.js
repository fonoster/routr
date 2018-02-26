/**
 * @author Pedro Sanders
 * @since v1
 */
import { Status } from 'data_provider/status'
import getConfig from 'core/config_util'
import isEmpty from 'utils/obj_util'
import DSUtils from 'data_provider/utils'

const Jedis = Packages.redis.clients.jedis.Jedis
const ObjectId = Packages.org.bson.types.ObjectId
const JsonPath = Packages.com.jayway.jsonpath.JsonPath

export default class DataSource {

    constructor() {
        const config = getConfig()
        this.jedis = new Jedis()
    }

    withCollection(collection) {
        this.collection = collection;
        return this;
    }

    insert(obj) {
        if (!DSUtils.isValidEntity(obj)) {
            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value
            }
        }

        if (!obj.metadata.ref) obj.metadata.ref = new ObjectId().toString()
        this.jedis.set(obj.metadata.ref, JSON.stringify(obj))
        const kind = DSUtils.getKind(obj)
        this.jedis.sadd(kind.toLowerCase() + 's', obj.metadata.ref)

        return {
            status: Status.BAD_REQUEST,
            message: Status.message[Status.BAD_REQUEST].value,
            result: obj.metadata.ref
        }
    }

    get(ref) {
        const result = this.jedis.get(obj.metadata.ref)

        if (result != null) {
            return {
                status: Status.OK,
                message: Status.message[Status.NOT_FOUND].value,
                result: result
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value,
        }
    }

    find(filter = '*') {
        if (!isEmpty(filter) && !filter.equals('*')) {
            filter = "*.[?(" + filter + ")]"
        }

        let list = []

        this.jedis.smembers(this.collection).forEach(ref => {
            const entry = JSON.parse(this.jedis.get(ref))
            list.push(entry)
        })

        try {
            if (list.length == 0) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    result: []
                }
            }
            // JsonPath does not parse properly when using Json objects from JavaScript
            list = JSON.parse(JsonPath.parse(JSON.stringify(list)).read(filter).toJSONString())
        } catch(e) {
            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value
            }
        }

        return {
            status: Status.OK,
            message: Status.message[Status.OK].value,
            result: list
        }
    }

    update(obj) {
        if (!DSUtils.isValidEntity(obj)) {
            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value
            }
        }

        const response = this.get(obj.metadata.ref)

        if (response.status == Status.NOT_FOUND) return response

        try {
            const kind = DSUtils.getKind(obj)
            this.jedis.set(obj.metadata.ref, obj)
        } catch(e) {
            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value
            }
        }

        return {
            status: Status.OK,
            message: Status.message[Status.OK].value,
            result: obj.metadata.ref
        }
    }

    remove(ref) {
        try {
            this.jedis.del(ref)
            this.jedis.srem(this.collection, ref)
        } catch(e) {
            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value
            }
        }

        return {
            status: Status.OK,
            message: Status.message[Status.OK].value
        }
    }
}
