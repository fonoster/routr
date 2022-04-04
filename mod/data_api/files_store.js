/**
 * @author Pedro Sanders
 * @since v1
 */
const HashMap = Java.type('java.util.HashMap')
const ChronicleMap = Java.type('net.openhft.chronicle.map.ChronicleMap')
const String = Java.type('java.lang.String')
const Long = Java.type('java.lang.Long')
const File = Java.type('java.io.File')
const System = Java.type('java.lang.System')
const TEN_THOUSAND = new Long(10000)

class FilesStore {
  constructor () {
    this.collections = new HashMap()
  }

  put (c, k, v) {
    return this.getSharedHashMap(c).put(k, v)
  }

  get (c, k) {
    return this.getSharedHashMap(c).get(k)
  }

  remove (c, k) {
    return this.getSharedHashMap(c).remove(k)
  }

  values (c) {
    return this.getSharedHashMap(c)
      .values()
      .toArray()
  }

  keySet (c) {
    return this.getSharedHashMap(c)
      .keySet()
      .toArray()
  }

  getSharedHashMap (name) {
    let h = this.collections.get(name)
    if (h === null) {
      h = ChronicleMap.of(String, String)
        .averageKey('sip:john@bingenterprise.local')
        .averageValueSize(300)
        .entries(TEN_THOUSAND)
        .name(name)
        .createPersistedTo(
          new File(`${System.getProperty('user.dir')}/${name}.dat`)
        )

      this.collections.put(name, h)
    }
    return h
  }
}

module.exports = FilesStore
