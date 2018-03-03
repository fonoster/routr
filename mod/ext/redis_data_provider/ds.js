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
const InvalidPathException = Packages.com.jayway.jsonpath.InvalidPathException

export default class DataSource {

    constructor() {
        const config = getConfig()
        this.jedis = new Jedis(config.spec.dataSource.parameters.host,
            config.spec.dataSource.parameters.port)

        if (config.spec.dataSource.parameters.secret) {
            this.jedis.password(config.spec.dataSource.parameters.secret)
        }
    }

    withCollection(collection) {
        this.collection = collection;
        return this;
    }

    insert(obj) {
        try {
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
                status: Status.CREATED,
                message: Status.message[Status.CREATED].value,
                result: obj.metadata.ref
            }
        } catch(e) {
            e.printStackTrace()
            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        }
    }

    get(ref) {
        try {
            const result = this.jedis.get(obj.metadata.ref)

            if (result != null) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    result: result
                }
            }

            return {
                status: Status.NOT_FOUND,
                message: Status.message[Status.NOT_FOUND].value,
            }
        } catch(e) {
             return {
                 status: Status.INTERNAL_SERVER_ERROR,
                 message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                 result: e.getMessage()
             }
         }
    }

    find(filter = '*') {
        if (!isEmpty(filter) && !filter.equals('*')) {
            filter = "*.[?(" + filter + ")]"
        }

        let list = []

        try {

            this.jedis.smembers(this.collection).forEach(ref => {
                const entry = JSON.parse(this.jedis.get(ref))
                list.push(entry)
            })


            if (list.length == 0) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    result: []
                }
            }
            // JsonPath does not parse properly when using Json objects from JavaScript
            list = JSON.parse(JsonPath.parse(JSON.stringify(list)).read(filter).toJSONString())

            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: list
            }
        } catch(e) {
            if (e instanceof InvalidPathException) {
                return {
                    status: Status.BAD_REQUEST,
                    message: Status.message[Status.BAD_REQUEST].value,
                    result: e.getMessage()
                }
            }

            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        }
    }

    update(obj) {
        if (!obj.metadata.ref || !DSUtils.isValidEntity(obj)) {
            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value
            }
        }

        try {
            this.jedis.set(obj.metadata.ref, JSON.stringify(obj))

            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: obj.metadata.ref
            }

        } catch(e) {
            if (e instanceof InvalidPathException) {
                return {
                    status: Status.BAD_REQUEST,
                    message: Status.message[Status.BAD_REQUEST].value,
                    result: e.getMessage()
                }
            }

            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        }
    }

    remove(ref) {
        try {
            let cnt = this.jedis.del(ref)

            if (cnt == 0) {
                return {
                    status: Status.NOT_FOUND,
                    message: Status.message[Status.NOT_FOUND].value,
                }
            }

            cnt = this.jedis.srem(this.collection, ref)

            if (cnt == 0) {
                return {
                    status: Status.NOT_FOUND,
                    message: Status.message[Status.NOT_FOUND].value,
                }
            }

            return {
                status: Status.OK,
                message: Status.message[Status.OK].value
            }
        } catch(e) {
            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value
            }
        }
    }

}
