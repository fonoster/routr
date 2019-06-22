/**
 * @author Pedro Sanders
 * @since v1
 */
const IPUtil = require('@routr/core/ip_util')

class Rule {

    constructor(net, action) {
        if (action.equals('allow') || action.equals('deny')) {
          const subnetUtils = IPUtil.getSubnetUtils(net)
          this.subnetUtils = subnetUtils
          this._action = action
          this._net = net
        } else {
          throw "Parameter action can only be 'allow' or 'deny'"
        }
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

module.exports = Rule
