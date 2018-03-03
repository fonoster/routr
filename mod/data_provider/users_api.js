/**
 * @author Pedro Sanders
 * @since v1
 */
import DataSource from 'data_provider/ds'
import DSUtil from 'data_provider/utils'
import FilesUtil from 'utils/files_util'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class UsersAPI {

    constructor(resourcePath = 'config/users.yml') {
        this.resourcePath = resourcePath
        this.schemaPath = 'etc/schemas/users_schema.json'
        this.ds = new DataSource()

        if (!DSUtil.isValidDataSource(this.schemaPath, FilesUtil.readFile(resourcePath))) {
            throw "Invalid 'config/users.yml' resource. Server unable to continue..."
        }
    }

    createFromJSON(jsonObj) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateFromJSON(jsonObj) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    getUsers(filter) {
        let response = this.ds.withCollection('users').find(filter)

        response.result.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.credentials.username)
            }
        })

        return response
    }

    getUser(username) {
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
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
                result: user
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getUserByRef(ref) {
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
        let user

        resource.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.credentials.username)
            }

            if (ref == obj.metadata.ref) {
                user = obj
            }
        })

        if (!isEmpty(user)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: user
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    deleteUser(ref) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    generateRef(username) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(username))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "us" + hash.substring(hash.length() - 6).toLowerCase()
    }

}