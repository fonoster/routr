/**
 * @author Pedro Sanders
 * @since v1
 */
class RegFailureManager {
  constructor(store) {
    this.store = store.withCollection('regFailure')
  }

  reportFailure(ref) {
    const item = this.store.get(ref)
      ? JSON.parse(this.store.get(ref))
      : { ref, failures: 0 }

    // We will ignore the GW for a maximum of 60 minutes
    if (item.failures < 60) {
      item.failures = item.failures + 1
    }

    this.store.put(ref, JSON.stringify(item))
  }

  clearCount(ref) {
    const refs = this.getRefs()
    refs.forEach(currentRef => {
      if (ref === currentRef) {
        const item = JSON.parse(this.store.get(ref))
        item.failures = item.failures - 1
        if (item.failures <= 0) {
          this.store.remove(ref)
        } else {
          this.store.put(ref, JSON.stringify(item))
        }
      }
    })
  }

  clearAll() {
    const refs = this.getRefs()
    refs.forEach(ref => {
      this.store.remove(ref)
    })
  }


  getRefs() {
    return this.getAsArray().map(item => item.ref)
  }

  getAsArray() {
    if (!this.store.values()) return []
    return  this.store.values().map(e => JSON.parse(e))
  }
}

module.exports = RegFailureManager