/**
 * @author Pedro Sanders
 * @since v1
 */
const Jwts = Packages.io.jsonwebtoken.Jwts
const SignatureAlgorithm = Packages.io.jsonwebtoken.SignatureAlgorithm
const Base64 = Packages.java.util.Base64
const String = Packages.java.lang.String

module.exports = function (req, res, salt) {
    const eUsername = req.headers('Authorization').split(' ')[1]
    const username = new String(Base64.getDecoder().decode(eUsername)).split(':')[0]
    const token = Jwts.builder()
        .setSubject(username)
          .signWith(SignatureAlgorithm.HS512, salt)
            .compact()
    return token
}
