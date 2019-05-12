/**
 * Stores transaction information in memory. Used by processor.js and registry_helper
 *
 * @author Pedro Sanders
 * @since v1
 */
class ContextStorage {

    constructor() {
        this.storage = new java.util.ArrayList()
    }

    saveContext(context) {
        this.storage.add(context)
    }

    findContext(trans) {
        const iterator = this.storage.iterator()
        while(iterator.hasNext()) {
            const context = iterator.next()

            if (context.clientTransaction == trans ||
                context.serverTransaction == trans) {
                return context
            }
        }
    }

    removeContext(trans) {
        const iterator = this.storage.iterator()
        while(iterator.hasNext()) {
            const context = iterator.next()

            if (context.clientTransaction == trans ||
                context.serverTransaction == trans) {
                iterator.remove()
                return true
            }
        }
        return false
    }

    getStorage() {
        return this.storage
    }
}

module.exports = ContextStorage
