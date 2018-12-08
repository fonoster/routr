/**
 * @author Pedro Sanders
 * @since v1
 */
const Jwts = Packages.io.jsonwebtoken.Jwts
const halt = Packages.spark.Spark.halt

export default function (req, res, salt) {
    try {
        Jwts.parser().setSigningKey(salt).parseClaimsJws(req.queryParams('token'))
    } catch(e) {
        halt(401, '{\"status\": \"401\", \"message\":\"Unauthorized\"}');
    }
}
