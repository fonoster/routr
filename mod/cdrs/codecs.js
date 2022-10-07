/**
 * Stores in memory information about sip transactions.
 *
 * @author Pedro Sanders
 * @since v1
 */
const Codec = {
  'a=rtpmap:9': 'g.722',
  'a=rtpmap:0': 'pcmu',
  'a=rtpmap:8': 'pcma',
  'a=rtpmap:18': 'g.729',
  'a=rtpmap:3': 'gsm'
}

module.exports = sdp => {
  for (let codec in Codec) {
    if (sdp.indexOf(codec) > -1) {
      return Codec[codec]
    }
  }
  return 'UNKNOWN'
}
