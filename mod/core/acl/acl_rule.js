/**
 * @author Pedro Sanders
 * @since v1
 */
import IPUtil from 'core/ip_util'

const SubnetUtils = Packages.org.apache.commons.net.util.SubnetUtils

export default class Rule {

    constructor(action, net) {
        if (!action.equals('allow') && !action.equals('deny'))
            throw "Parameter action can only be 'allow' or 'deny'"
        const subnetUtils = IPUtil.getSubnetUtils(net)
        this.subnetUtils = subnetUtils
        this._action = action
        this._net = net
    }

    hasIp(address) {
        return this.subnetUtils.getInfo().isInRange(address)
    }

    getAddressCount() {
        return this.subnetUtils.getInfo().getAddressCountLong()
    }

    get action () {
        return this._action
    }

    get net () {
        return this._net
    }
}
