/**
 * @author Pedro Sanders
 * @since v1
 */
import DataSource from 'ext/redis_data_provider/ds'
import DSUtil from 'data_provider/utils'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class UsersAPI {

    constructor() {
        this.ds = new DataSource()
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
        return this.ds.withCollection('users').filter(filter)
    }

    getUser(username) {
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