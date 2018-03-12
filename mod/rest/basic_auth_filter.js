/**
 * @author Pedro Sanders
 * @since v1
 */
const halt = Packages.spark.Spark.halt
const Base64 = Packages.org.apache.commons.codec.binary.Base64
const StringUtils = Packages.org.apache.commons.lang3.StringUtils

export default function (req, res, usersAPI) {
    if (!validAuthHeader(req)) halt(401, "{\"status\": \"401\", \"message\":\"Unauthorized\"}")

    let user = getUserFromHeader(req)

    if (!authentic(usersAPI, user)) halt(401, "{\"status\": \"401\", \"message\":\"Unauthorized\"}")
}

function validAuthHeader(req) {
    try {
        StringUtils.substringAfter(req.headers("Authorization"), "Basic")
    } catch(e) {
        return false
    }
    return true
}

function getUserFromHeader(req) {
    let encodedHeader = StringUtils.substringAfter(req.headers("Authorization"), "Basic")

    let decodedHeader = new java.lang.String(Base64.decodeBase64(encodedHeader))

    let username = decodedHeader.split(":")[0]
    let password = decodedHeader.split(":")[1]

    return {
        username: username,
        password: password
    }
}

function authentic(usersAPI, user) {
    try {
        const response = usersAPI.getUserByUsername(user.username)
        let dbUser = response.result

        if (!dbUser.spec.credentials.secret.equals(user.password)) {
            return false
        }
    } catch (e) {
        return false
    }
    return true
}