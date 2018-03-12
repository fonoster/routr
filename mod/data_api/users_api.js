/**
 * @author Pedro Sanders
 * @since v1
 */
import { Status } from 'data_api/status'
import isEmpty from 'utils/obj_util'

export default class UsersAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    createFromJSON(jsonObj) {
        if(this.userExist(jsonObj.spec.credentials.username)) {
            return {
                status: Status.CONFLICT,
                message: Status.message[Status.CONFLICT].value,
            }
        }
        return this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        if(this.userExist(jsonObj.spec.credentials.username)) {
            return {
                status: Status.NOT_FOUND,
                message: Status.message[Status.NOT_FOUND].value,
            }
        }
        return this.ds.update(jsonObj)
    }

    getUsers(filter) {
        return this.ds.withCollection('users').find(filter)
    }

    getUser(ref) {
        const response = this.getUsers()
        let user

        response.result.forEach(obj => {
            if (obj.metadata.ref == ref) {
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

    getUserByUsername(username) {
        const response = this.getUsers()
        let user

        response.result.forEach(obj => {
            if (obj.spec.credentials.username == username) {
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

    userExist(username) {
        const response = this.getUser(username)
        if (response.status == Status.OK) return true
        return false
    }

    deleteUser(ref) {
        return this.ds.withCollection('users').remove(ref)
    }

}