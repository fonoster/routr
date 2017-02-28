/**
 * Stores transaction information in memory. Used by processor.js and registry_helper
 *
 * @author Pedro Sanders
 * @since v1
 */
function ContextStorage() {
    const storage = new java.util.ArrayList()

    this.saveContext = context => storage.add(context)

    this.findContext = trans => {
        const iterator = storage.iterator()
        while(iterator.hasNext()) {
            const context = iterator.next()

            if (context.clientTransaction.equals(trans) ||
                context.serverTransaction.equals(trans)) {
                return context
            }
        }
    }

    this.removeContext = trans => {
        const iterator = storage.iterator()
        while(iterator.hasNext()) {
            const context = iterator.next()

            if (context.clientTransaction.equals(trans) ||
                context.serverTransaction.equals(trans)) {
                iterator.remove()
                return true
            }
        }
        return false
    }

    this.getStorage = () => storage
}
