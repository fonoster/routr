/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_api/utils'
import { Status } from 'data_api/status'
import isEmpty from 'utils/obj_util'

export default class UsersAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    createFromJSON(jsonObj) {
        if(this.userExist(jsonObj.spec.credentials.username)) {
            return DSUtil.buildResponse(Status.CONFLICT)
        }
        return this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        if(this.userExist(jsonObj.spec.credentials.username)) {
            return DSUtil.buildResponse(Status.NOT_FOUND)
        }
        return this.ds.update(jsonObj)
    }

    getUsers(filter) {
        return this.ds.withCollection('users').find(filter)
    }

    getUser(ref) {
        return DSUtil.deepSearch(this.getUsers().result, "metadata.ref", ref)
    }

    getUserByUsername(username) {
        return DSUtil.deepSearch(this.getUsers().result, "spec.credentials.username", username)
    }

    userExist(username) {
        return DSUtil.objExist(this.getUser(username))
    }

    deleteUser(ref) {
        return this.ds.withCollection('users').remove(ref)
    }

}