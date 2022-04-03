/**
 * @author Pedro Sanders
 * @since v1
 */
const Jwts = Java.type('io.jsonwebtoken.Jwts')

module.exports = function (req, res, salt) {
  try {
    Jwts.parser()
      .setSigningKey(salt)
      .parseClaimsJws(req.queryParams('token'))
  } catch (e) {
    throw 'UNAUTHORIZED REQUEST'
  }
}
