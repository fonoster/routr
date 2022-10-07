/**
 * Stores in memory information about sip transactions.
 *
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')
const CDRSender = Java.type('io.routr.core.CDRSender')
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger(Java.type('io.routr.core.Launcher'))

class EventsHandler {
  constructor () {
    LOG.debug('Starting CDRS EventsManager')

    postal.subscribe({
      channel: 'cdrs',
      topic: 'cdr.started',
      callback: data => this.processEvent(data.cdr)
    })

    postal.subscribe({
      channel: 'cdrs',
      topic: 'cdr.complete',
      callback: data => this.processEvent(data.cdr)
    })

    this.sender = new CDRSender()
  }

  processEvent (cdr) {
    this.sender.sendCallRecord(JSON.stringify(cdr))
  }
}

module.exports = EventsHandler
