/**
 * @author Pedro Sanders
 * @since v1
 */
const Jwts = Java.type('io.jsonwebtoken.Jwts')
const halt = Java.type('spark.Spark').halt

module.exports = function (req, res, salt) {
    try {
        Jwts.parser().setSigningKey(salt).parseClaimsJws(req.queryParams('token'))
    } catch(e) {
        halt(401, '{\"status\": \"401\", \"message\":\"Unauthorized\"}');
    }
}
