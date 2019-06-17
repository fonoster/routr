/**
 * @author Pedro Sanders
 * @since v1
 */
const postal = require('postal')

class CancelHandler {
    doProcess(request, serverTransaction) {
        postal.publish({
            channel: "processor",
            topic: "transaction.cancel",
            data: {
                transactionId: serverTransaction.getBranchId()
            }
        })
    }
}

module.exports = CancelHandler
