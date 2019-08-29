
module.exports.equalsIgnoreCase = (a, b) => a.toLowerCase() === b.toLowerCase()

module.exports.gatewayPatch = (h, p) => `${h}${p? ':' + p: ''}`
