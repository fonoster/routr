/**
 * @author Pedro Sanders
 * @since v1
 */
 const {
   hasIp,
   addressCount
 } = require('@routr/core/ip_util')

class Rule {

    constructor(net, action) {
        if (action === 'allow' || action === 'deny') {
            this._action = action
            this._net = net
        } else {
            throw "Parameter action can only be 'allow' or 'deny'"
        }
    }

    hasIp(address) {
        return hasIp(this._net, address)
    }

    getAddressCount() {
        return addressCount(this._net)
    }

    get action() {
        return this._action
    }

    get net() {
        return this._net
    }
}

module.exports = Rule
