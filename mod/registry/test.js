/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Registry Module"
 */
import Registry from 'registry/registry'
import GatewaysAPI from 'resources/gateways_api'
const InetAddress = Packages.java.net.InetAddress

const dataAPIs = {
    GatewaysAPI: new GatewaysAPI()
}

export let testGroup = { name: "Registry Module" }

// Tests
testGroup.store_registry = function () {


    const registry = new Registry(null, dataAPIs)
    registry.storeRegistry('29121', 'sanjose2.voip.ms', 200)
    assertFalse(registry.listAsJSON().isEmpty())
    assertTrue(registry.hasHost('sanjose2.voip.ms'))
    assertFalse(registry.hasHost('atlanta.voip.ms'))

    const hostAddress = InetAddress.getByName('sanjose2.voip.ms').getHostAddress()
    assertTrue(registry.hasIp(hostAddress))
}

