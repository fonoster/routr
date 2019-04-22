/**
 * @author Pedro Sanders
 * @since v1
 */
const Jwts = Packages.io.jsonwebtoken.Jwts
const SignatureAlgorithm = Packages.io.jsonwebtoken.SignatureAlgorithm
const Base64 = Packages.java.util.Base64

export default function (req, res, salt) {
    const eAuth = req.headers('Authorization')
    const eUsername = eAuth.split(' ')[1]
    const username = new Packages.java.lang.String(Base64.getDecoder()
        .decode(eUsername)).split(':')[0]
    return Jwts.builder()
        .setSubject(username)
        .signWith(SignatureAlgorithm.HS512, salt)
        .compact();
}
