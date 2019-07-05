/**
 * @author Pedro Sanders
 * @since v1
 */
const halt = Java.type('spark.Spark').halt
const Base64 = Java.type('org.apache.commons.codec.binary.Base64')
const StringUtils = Java.type('org.apache.commons.lang3.StringUtils')
const String = Java.type('java.lang.String')

module.exports = function(req, res, usersAPI) {
    if (!validAuthHeader(req)) halt(401, '{\"status\": \"401\", \"message\":\"You are unauthorized to make this request.\"}')
    try {
        if (!authentic(usersAPI, getUserFromHeader(req))) halt(401, '{\"status\": \"401\", \"message\":\"You are unauthorized to make this request.\"}')
    } catch (e) {
        // If it gets here is because it din't send its credentials
        halt(401, '{\"status\": \"401\", \"message\":\"You are unauthorized to make this request.\"}')
    }
}

function validAuthHeader(req) {
    try {
        StringUtils.substringAfter(req.headers('Authorization'), 'Basic')
    } catch (e) {
        return false
    }
    return true
}

function getUserFromHeader(req) {
    const encodedHeader = StringUtils.substringAfter(req.headers('Authorization'), 'Basic')
    const decodedHeader = new String(Base64.decodeBase64(encodedHeader))
    return {
        username: decodedHeader.split(':')[0],
        password: decodedHeader.split(':')[1]
    }
}

function authentic(usersAPI, user) {
    try {
        const response = usersAPI.getUserByUsername(user.username)
        if (!response.result.spec.credentials.secret.equals(user.password)) {
            return false
        }
    } catch (e) {
        return false
    }
    return true
}
