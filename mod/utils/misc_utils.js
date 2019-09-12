/**
 * @author Pedro Sanders
 * @since v1
 *
 * Miscellaneous utilities
 */
module.exports.equalsIgnoreCase = (a, b) => a.toLowerCase() === b.toLowerCase()
module.exports.buildAddr = (h, p) => `${h}${p? ':' + p: ''}`
module.exports.protocolTransport = (config, proto) => {
    try {
        const transport = config.spec.transport.filter(trans => trans.protocol === proto)[0]
        if (!transport.bindAddr) transport.bindAddr = config.spec.bindAddr
        return transport
    } catch(e) {
        throw `Transport \'${proto}\' not found in configs => .spec.transport.[*]`
    }
}
// Returns the address for the neareast interface to a targeted host
module.exports.nearestInterface = (h, p, h1, p1) => {
    const host = h1? h1 : h
    const port = p1? p1 : p
    return { host, port }
}
