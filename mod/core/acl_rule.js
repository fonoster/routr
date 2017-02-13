function Rule(action, p) {
    var LogManager = Java.type('org.apache.logging.log4j.LogManager')
    let LOG = LogManager.getLogger()
    let SubnetUtils  = Java.type('org.apache.commons.net.util.SubnetUtils')
    let cidrPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/
    let ipPattern = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/
    let su

    function isIp (v) {return ipPattern.test(v)}
    function isCidr (v) {return cidrPattern.test(v) && new java.lang.String(v).contains("/")}

    function isIpAndMask(v) {
        let s = v.split("/")
        if (s.length != 2) return false
        if (isIp(s[0]) && isIp(s[1])) return true
        return false;
    }

    if(isIp(p)){
        su = new SubnetUtils(p + "/31")
    } else if(isCidr(p)) {
        su = new SubnetUtils(p)
    } else if(isIpAndMask(p)) {
        let s = p.split("/")
        su = new SubnetUtils(s[0], s[1])
    } else {
        throw new java.lang.RuntimeException("Invalid rule notation. Must be IPv4 value, CIDR, or Ip/Mask notation.")
    }

    this.action = action

    su.setInclusiveHostCount(true)

    this.hasIp = function(address) {return su.getInfo().isInRange(address)}
    this.getAddressCount= function() {return su.getInfo().getAddressCountLong()}
    this.getAction = function() {return this.action}
}
