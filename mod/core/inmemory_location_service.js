var HashMap    = Java.type('java.util.HashMap')
var LogManager = Java.type('org.apache.logging.log4j.LogManager')

// In memory location service
function LocationService() {
    var LOG = LogManager.getLogger()
    var db = new HashMap()

    this.put = function (k, v) {
        db.put(k.toString(), v)
    }

    this.get = function(k) {
        return db.get(k.toString())
    }

    this.remove = function(k) {
        db.remove(k)
    }

    this.printAll = function () {
        let k = db.keySet().iterator()

        while(k.hasNext()) {
            let key = k.next()
            LOG.info("The endpoint " + key + " is " + db.get(key) + " in Sip I/O")
        }
    }
}