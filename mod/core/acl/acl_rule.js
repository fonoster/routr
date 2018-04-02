/**
 * @author Pedro Sanders
 * @since v1
 */
const SubnetUtils = Packages.org.apache.commons.net.util.SubnetUtils
const cidrPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/
const ipPattern = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/

export default class Rule {

    constructor(action, net) {
        if (!action.equals('allow') && !action.equals('deny'))
            throw "Parameter action can only be 'allow' or 'deny'"

        const subnetUtils = this.selectSUForNet(net)
        subnetUtils.setInclusiveHostCount(true)

        this.subnetUtils = subnetUtils
        this._action = action
        this._net = net
    }

    selectSUForNet(net) {
        if(this.isIp(net)) {
            return new SubnetUtils(net + '/31')
        } else if(this.isCidr(net)) {
            return new SubnetUtils(net)
        } else if(this.isIpAndMask(net)) {
            const s = net.split('/')
            return new SubnetUtils(s[0], s[1])
        }

        throw new java.lang.RuntimeException('Invalid rule notation. Must be IPv4 value, CIDR, or Ip/Mask notation.')
    }

    isIp(v) {
        return ipPattern.test(v)
    }

    isCidr(v) {
        return cidrPattern.test(v) && new java.lang.String(v).contains('/')
    }

    isIpAndMask(v) {
        let s = v.split('/')
        if (s.length != 2) return false
        if (isIp(s[0]) && isIp(s[1])) return true
        return false
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
