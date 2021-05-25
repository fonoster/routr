/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')

class CancelHandler {
  doProcess (transaction) {
    postal.publish({
      channel: 'processor',
      topic: 'transaction.cancel',
      data: {
        transaction
      }
    })
  }
}

module.exports = CancelHandler
