/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const {
    Status
} = require('@routr/core/status')

class UsersAPI {

    constructor(dataSource) {
        this.ds = dataSource
    }

    createFromJSON(jsonObj) {
        const errors = DSUtils.validateEntity(jsonObj)
        if (errors.length > 0) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY, errors)
        }

        return this.userExist(jsonObj.spec.credentials.username)
          ? CoreUtils.buildResponse(Status.CONFLICT)
          : this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        if (!jsonObj.metadata || !jsonObj.metadata.ref) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY,
                DSUtils.roMessage('metadata.ref'))
        }

        const oldObj = this.getUser(jsonObj.metadata.ref).data

        if (!oldObj || !oldObj.kind) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY)
        }

        // Patch with the wO fields
        const patchObj = DSUtils.patchObj(oldObj, jsonObj)
        const errors = DSUtils.validateEntity(patchObj, oldObj, 'write')

        if (errors.length > 0) {
            return CoreUtils.buildResponse(Status.UNPROCESSABLE_ENTITY, errors)
        }

        return !this.userExist(patchObj.spec.credentials.username)
          ? CoreUtils.buildResponse(Status.NOT_FOUND)
          : this.ds.update(patchObj)
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
        return DSUtils.objExist(this.getUserByUsername(username))
    }

    deleteUser(ref) {
        return this.ds.withCollection('users').remove(ref)
    }
}

module.exports = UsersAPI
