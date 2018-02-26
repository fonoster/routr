/**
 * @author Pedro Sanders
 * @since v1
 */
const Jwts = Packages.io.jsonwebtoken.Jwts
const SignatureAlgorithm = Packages.io.jsonwebtoken.SignatureAlgorithm
const halt = Packages.spark.Spark.halt

export default function (req, res, salt) {
    const token = req.queryParams("token")
    try {
        const valid = Jwts.parser().setSigningKey(salt).parseClaimsJws(token)
    } catch(e) {
        halt(401, "{\"status\": \"401\", \"message\":\"Unauthorized\"}");
    }
}
