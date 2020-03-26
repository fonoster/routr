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
        transactionId: transaction.getBranchId()
      }
    })
  }
}

module.exports = CancelHandler
