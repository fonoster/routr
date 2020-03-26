/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Users API on Redis Data Source"
 */
const RedisDataSource = require('@routr/data_api/redis_datasource')
const UsersAPI = require('@routr/data_api/users_api')
const TestUtils = require('@routr/data_api/test_utils')
const DSUtils = require('@routr/data_api/utils')
const ObjectId = Java.type('org.bson.types.ObjectId')
const {
  UNFULFILLED_DEPENDENCY_RESPONSE,
  Status
} = require('@routr/core/status')
const assert = require('assert')
const config = require('@routr/core/config_util')()

// Forces RedisDataSource to use its own default parameters
delete config.spec.dataSource.parameters
const ds = new RedisDataSource(config)
const usersApi = new UsersAPI(ds)

describe('Users API(on Redis)', () => {
  beforeEach(() => ds.flushAll())

  it('Create user', done => {
    // Test entity missing required fields
    const user = TestUtils.buildUser('Administrator', 'admin')
    delete user.metadata.name
    let response = usersApi.createFromJSON(user)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Bad kind
    user.metadata.name = 'User'
    user.kind = 'Userx'
    response = usersApi.createFromJSON(user)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Test for good resource
    user.kind = 'User'
    response = usersApi.createFromJSON(user)
    assert.equal(response.status, Status.CREATED)

    // Test uniqueness
    response = usersApi.createFromJSON(user)
    assert.equal(response.status, Status.CONFLICT)
    done()
  })

  it('Update user', done => {
    // Test entity missing required fields
    const user = TestUtils.buildUser('Administrator', 'admin')
    usersApi.createFromJSON(user)
    delete user.kind
    response = usersApi.updateFromJSON(user)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Bad kind
    user.kind = 'Userx'
    response = usersApi.updateFromJSON(user)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Bad reference
    const ref = user.metadata.ref
    user.kind = 'User'
    user.metadata.ref = 'abc'
    response = usersApi.updateFromJSON(user)
    assert.equal(response.status, Status.UNPROCESSABLE_ENTITY)

    // Test for good resource
    user.metadata.ref = ref
    response = usersApi.updateFromJSON(user)
    assert.equal(response.status, Status.OK)
    done()
  })
})
