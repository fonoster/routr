/**
 * @author Pedro Sanders
 * @since v1
 */
const Jwts = Java.type('io.jsonwebtoken.Jwts')
const SignatureAlgorithm = Java.type('io.jsonwebtoken.SignatureAlgorithm')
const Base64 = Java.type('java.util.Base64')
const String = Java.type('java.lang.String')

module.exports = (req, res, salt) => {
  const eUsername = req.headers('Authorization').split(' ')[1]
  const username = new String(Base64.getDecoder().decode(eUsername)).split(
    ':'
  )[0]
  return Jwts.builder()
    .setSubject(username)
    .signWith(SignatureAlgorithm.HS512, salt)
    .compact()
}
