/**
 * Stores information on sip devices currently registered in the server.
 * This implementation won't scale to thousands of devices.
 *
 * @author Pedro Sanders
 * @since v1
 */
function LocationService() {
    const HashMap = Packages.java.util.HashMap
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    const db = new HashMap()

    this.put = (k, v) => { db.put(k.toString(), v) }

    this.get = k => db.get(k.toString())

    this.remove = k => { db.remove(k) }

    this.listAllAsJSON = () => {
        let s = []
        let k = db.keySet().iterator()

        while(k.hasNext()) {
            let key = k.next()
            let tmp = {'endpoint': key, 'contact': db.get(key).toString()}
            s.push(tmp)
        }

        return JSON.stringify(s)
    }
}
