/**
 * @author Pedro Sanders
 * @since v1
 */
import Rule from 'core/acl_rule'

/**
 * Helps verify if a device is allow or not to REGISTER and place calls.
 *
 * Rules may be in CIDR, IP/Mask, or single IP format. Example
 * of rules are:
 *
 * acl:
 *  deny:
        0.0.0.0/1   # deny all
 *  allow
      - 192.168.1.0/255.255.255.0
 *    - 192.168.0.1/31
 */
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class ACLHelper {

    constructor() {}

    mostSpecific = (rules, ip) {
        const r = rules
            .stream()
            .filter(rule => rule.hasIp(ip))
            .sorted((r1, r2) => java.lang.Integer.compare(r2.getAddressCount(), r1.getAddressCount()))
            .findFirst()

        if (r.isPresent()) {
            return r.get()
        }

        return new Rule('allow', '0.0.0.0/1')
    }
}