/**
 * @author Pedro Sanders
 * @since v1
 */
const DSUtils = require('@routr/data_api/utils')
const APIBase = require('@routr/data_api/api_base')
const {
    Status
} = require('@routr/core/status')
const getCacheKey = j => j.spec.credentials.username

class UsersAPI extends APIBase {

    constructor(dataSource) {
        super(dataSource, 'users')
    }

    createFromJSON(jsonObj) {
        const hasUnfulfilledDependency = () => false
        const alreadyExist = j => this.userExist(j.spec.credentials.username)
        return super.createFromJSON(jsonObj, alreadyExist,
          hasUnfulfilledDependency, getCacheKey)
    }

    updateFromJSON(jsonObj) {
        return super.updateFromJSON(jsonObj, getCacheKey)
    }

    getUsers(filter) {
        return super.getResources(filter)
    }

    getUser(ref) {
        return super.getResource(ref)
    }

    getUserByUsername(username) {
        return DSUtils.deepSearch(this.getUsers(), "spec.credentials.username", username)
    }

    userExist(username) {
        return DSUtils.objExist(this.getUserByUsername(username))
    }

    deleteUser(ref) {
        return this.ds.withCollection('users').remove(ref)
    }
}

module.exports = UsersAPI
