/**
 * @author Pedro Sanders
 * @since v1
 */
const Base64 = Java.type('org.apache.commons.codec.binary.Base64')
const StringUtils = Java.type('org.apache.commons.lang3.StringUtils')
const String = Java.type('java.lang.String')

module.exports = (req, res, usersAPI) => {
  try {
    return authentic(usersAPI, getUserFromHeader(req))
  } catch (e) {
    throw 'UNAUTHORIZED REQUEST'
  }
}

function getUserFromHeader (req) {
  const encodedHeader = StringUtils.substringAfter(
    req.headers('Authorization'),
    'Basic'
  )
  const decodedHeader = new String(Base64.decodeBase64(encodedHeader))
  return {
    username: decodedHeader.split(':')[0],
    secret: decodedHeader.split(':')[1]
  }
}

function authentic (usersAPI, user) {
  try {
    const response = usersAPI.getUserByUsername(user.username)
    const credentials = response.data.spec.credentials
    return credentials.secret.equals(user.secret)
  } catch (e) {
    throw 'UNAUTHORIZED REQUEST'
  }
}
