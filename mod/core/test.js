/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Core Module"
 */
import ResourcesUtil from 'resources/utils'
import getConfig from 'core/config_util'

export let testGroup = { name: "Core Module" }

// Tests
testGroup.config_func = function () {
    const result = getConfig()
    assertTrue(result != undefined)
}

testGroup.validate_config = function () {
    const valid = new ResourcesUtil().isResourceValid('etc/schemas/config_schema.json', 'config/config.yml')
    assertTrue(valid)
}

