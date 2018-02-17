/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
import isEmpty from 'utils/obj_util'
import { Status } from 'resources/status'

export default class UsersAPI {

    constructor() {
        this.resourcePath = 'config/users.yml'
        this.schemaPath = 'etc/schemas/users_schema.json'
        this.rUtil = new ResourcesUtil()

        if (!this.rUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/users.yml' resource. Server unable to continue..."
        }
    }

    generateRef(username) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(username))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "us" + hash.substring(hash.length() - 6).toLowerCase()
    }

    getUsers(filter) {
        let objs = this.rUtil.getObjs(this.resourcePath, filter)

        objs.obj.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.credentials.username)
            }
        })

        return objs
    }

    getUser(username) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let user

        resource.forEach(obj => {
            if (obj.spec.credentials.username == username) {
               if (!obj.metadata.ref) {
                   obj.metadata.ref = this.generateRef(obj.spec.credentials.username)
               }
               user = obj
            }
        })

        if (!isEmpty(user)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: user
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getUserByRef(ref) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let agent

        resource.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.credentials.username)
            }

            if (ref == obj.metadata.ref) {
                agent = obj
            }
        })

        if (!isEmpty(agent)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: agent
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    createUser() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateUser() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    deleteUser(ref) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    createFromJSONObj() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateFromJSONObj() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }
}