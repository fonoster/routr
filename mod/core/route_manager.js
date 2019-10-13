/**
 * @author Pedro Sanders
 * @since v1
 *
 * Experimental API for programmable routing
 */
const findMatch = (rules, request) => {
    const result = rules.filter(rule => {
        const f = new Function('request', rule.match)
        return f(request)
    })

    // Will only return the first matching rule
    return result.length > 0 ? result[0] : null
}

const processRule = rule => console.log('processRule')

module.exports.findMatch = findMatch
module.exports.processRule = processRule
