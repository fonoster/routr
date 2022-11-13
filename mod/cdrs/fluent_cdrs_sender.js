/**
 * Stores in memory information about sip transactions.
 *
 * @author Pedro Sanders
 * @since v1
 */
const FluentLogger = Java.type('org.fluentd.logger.FluentLogger')
const HashMap = Java.type('java.util.HashMap')
const uLOG = FluentLogger.getLogger(
  'user',
  System.getenv('LOGS_DRIVER_HOST') || 'localhost',
  System.getenv('LOGS_DRIVER_PORT')
    ? parseInt(System.getenv('LOGS_DRIVER_PORT'))
    : 24224
)

function sendCallRecordToFluent (cdr) {
  const body = new HashMap()
  body.put('callId', cdr.callId)
  body.put('from', cdr.from)
  body.put('to', cdr.to)
  body.put('startTime', cdr.startTime.toISOString())
  body.put('gatewayRef', cdr.gatewayRef)
  body.put('gatewayHost', cdr.gatewayHost)
  body.put('routrInstance', cdr.routrInstance)
  body.put('codec', cdr.codec)
  body.put('endTime', cdr.endTime.toISOString())
  body.put('duration', cdr.duration)
  body.put('terminationCause', cdr.terminationCause)
  body.put('terminationCode', cdr.terminationCode)

  if (cdr.extraHeaders) {
    body.put(
      'extraHeaders',
      cdr.extraHeaders?.map(h => h.name + '=' + h.value).join(',')
    )
  }

  if (cdr.qos?.rtp) {
    const qos = new HashMap()
    const rtp = new HashMap()
    const rtcp = new HashMap()
    rtp.put('bytes', cdr.qos.rtp.bytes)
    rtp.put('packets', cdr.qos.rtp.packets)
    rtp.put('errors', cdr.qos.rtp.errors)
    rtcp.put('bytes', cdr.qos.rtcp.bytes)
    rtcp.put('packets', cdr.qos.rtcp.packets)
    rtcp.put('errors', cdr.qos.rtcp.errors)
    qos.put('rtp', rtp)
    qos.put('rtcp', rtcp)
    body.put('qos', qos)
  }

  const data = new HashMap()
  data.put('accessKeyId', cdr.accessKeyId)
  data.put('eventType', 'call')
  data.put('level', 'info')
  data.put('body', body)

  // Sending user.cdrs to fluentd
  uLOG.log('cdrs', data)
}

module.exports = {
  sendCallRecordToFluent
}
