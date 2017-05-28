/**
 * Stores transaction information in memory. Used by processor.js and registry_helper
 *
 * @author Pedro Sanders
 * @since v1
 */
export default function ContextStorage() {
    const storage = new java.util.ArrayList()

    this.saveContext = context => storage.add(context)

    this.findContext = trans => {
        const iterator = storage.iterator()
        while(iterator.hasNext()) {
            const context = iterator.next()

            if (context.clientTransaction == trans ||
                context.serverTransaction == trans) {
                return context
            }
        }
    }

    this.removeContext = trans => {
        const iterator = storage.iterator()
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

    this.getStorage = () => storage
}
