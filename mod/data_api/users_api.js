/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const { Status } = require('@routr/core/status')

class UsersAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    createFromJSON(jsonObj) {
        return this.userExist(jsonObj.spec.credentials.username)? CoreUtils.buildResponse(Status.CONFLICT):this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        return !this.userExist(jsonObj.spec.credentials.username)? CoreUtils.buildResponse(Status.NOT_FOUND):this.ds.update(jsonObj)
    }

    getUsers(filter) {
        return this.ds.withCollection('users').find(filter)
    }

    getUser(ref) {
        return this.ds.withCollection('users').get(ref)
    }

    getUserByUsername(username) {
        return DSUtils.deepSearch(this.getUsers(), "spec.credentials.username", username)
    }

    userExist(username) {
        return DSUtils.objExist(this.getUser(username))
    }

    deleteUser(ref) {
        return this.ds.withCollection('users').remove(ref)
    }

}

module.exports = UsersAPI
