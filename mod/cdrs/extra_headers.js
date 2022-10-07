/**
 * Stores in memory information about sip transactions.
 *
 * @author Pedro Sanders
 * @since v1
 */
module.exports = request => {
  const names = request.getHeaderNames()
  const extraHeaders = []
  while (names.hasNext()) {
    const name = names.next()
    if (name.startsWith('X-')) {
      extraHeaders.push({ name, value: request.getHeader(name).value })
    }
  }
  return extraHeaders
}
