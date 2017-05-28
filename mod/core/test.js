/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Resources Module"
 */
import getConfig from 'core/config_util'

export let testGroup = { name: "Core Module" }

// Tests
testGroup.config_func = function () {
    const result = getConfig()
    assertTrue(result != undefined)
}
