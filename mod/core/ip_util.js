/**
 * @author Pedro Sanders
 * @since v1
 */
import getConfig from 'core/config_util'
import isEmpty from 'utils/obj_util'

const SubnetUtils = Packages.org.apache.commons.net.util.SubnetUtils
const cidrPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/
const ipPattern = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/

export default class IPUtil {

    constructor(config) {
        if (!isEmpty(config)) {
            this.config = config
        } else {
            this.config = getConfig()
        }
        this.localnets = this.config.spec.localnets
    }

    getSubnetUtils(net) {
        let subnetUtils

        if(this.isIp(net)) {
            subnetUtils = new SubnetUtils(net + '/31')
        } else if(this.isCidr(net)) {
            subnetUtils = new SubnetUtils(net)
        } else if(this.isIpAndMask(net)) {
            let s = net.split('/')
            subnetUtils = new SubnetUtils(s[0], s[1])
        } else {
            throw new java.lang.RuntimeException('Invalid rule notation. Must be IPv4 value, CIDR, or Ip/Mask notation.')
        }
        subnetUtils.setInclusiveHostCount(true)
        return subnetUtils;
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
        if (this.isIp(s[0]) && this.isIp(s[1])) return true
        return false
    }

    isLocalnet(address) {
        let localnets = this.localnets
        if (isEmpty(localnets)) throw "No localnets found"

        for (let x in localnets) {
            let subnetUtils = this.getSubnetUtils(localnets[x])
            if (subnetUtils.getInfo().isInRange(address)) return true
        }
        return false;
    }
}
