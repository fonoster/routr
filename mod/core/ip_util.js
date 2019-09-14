/**
 * @author Pedro Sanders
 * @since v1
 */
const getConfig = require('@routr/core/config_util')
const isEmpty = require('@routr/utils/obj_util')

const SubnetUtils = Java.type('org.apache.commons.net.util.SubnetUtils')

const cidrPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/
const ipPattern = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/

class IPUtil {

    constructor(config) {
        if (!isEmpty(config)) {
            this.config = config
        } else {
            this.config = getConfig()
        }
        this.localnets = this.config.spec.localnets
    }

    isLocalnet(address) {
        const localnets = this.localnets
        if (isEmpty(localnets)) throw "No localnets found"

        for (const x in localnets) {
            const subnetUtils = IPUtil.getSubnetUtils(localnets[x])
            if (subnetUtils.getInfo().isInRange(address)) return true
        }
        return false
    }

    static getSubnetUtils(net) {
        let subnetUtils

        if (IPUtil.isIp(net)) {
            subnetUtils = new SubnetUtils(`${net}/31`)
        } else if (IPUtil.isCidr(net)) {
            subnetUtils = new SubnetUtils(net)
        } else if (IPUtil.isIpAndMask(net)) {
            const s = net.split('/')
            subnetUtils = new SubnetUtils(s[0], s[1])
        } else {
            throw new java.lang.RuntimeException('Invalid rule notation. Must be IPv4 value, CIDR, or Ip/Mask notation.')
        }

        subnetUtils.setInclusiveHostCount(true)
        return subnetUtils
    }

    static isIp(v) {
        return ipPattern.test(v)
    }

    static isCidr(v) {
        return cidrPattern.test(v) && v.includes('/')
    }

    static isIpAndMask(v) {
        const s = v.split('/')
        if (s.length !== 2) return false
        if (IPUtil.isIp(s[0]) && IPUtil.isIp(s[1])) return true
        return false
    }
}

module.exports = IPUtil
