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
        return this.userExist(jsonObj.spec.credentials.username)? DSUtil.buildResponse(Status.CONFLICT):this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        return !this.userExist(jsonObj.spec.credentials.username)? DSUtil.buildResponse(Status.NOT_FOUND):this.ds.update(jsonObj)
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