/**
 * @author Pedro Sanders
 * @since v1
 */
// Speed up calls to hasOwnProperty
const hasOwnProperty = Object.prototype.hasOwnProperty

module.exports = function isEmpty(obj) {
    if (obj === null || obj === undefined) return true
    if (obj.length > 0) return false
    if (obj.length === 0) return true
    if (typeof obj !== "object") return true
    for (let key in obj) {
        if (hasOwnProperty.call(obj, key)) return false
    }
    return true
}
