/**
 * Stores in memory information about sip transactions.
 *
 * @author Pedro Sanders
 * @since v1
 */
const TerminationCause = {
  '-1': 'UNKNOWN',
  '0': 'CAUSE_NORMAL_CLEARING',
  '1': 'CAUSE_UNALLOCATED',
  '17': 'CAUSE_USER_BUSY',
  '18': 'CAUSE_NO_USER_RESPONSE',
  '21': 'CAUSE_CALL_REJECTED',
  '28': 'CAUSE_INVALID_NUMBER_FORMAT',
  '34': 'CAUSE_NORMAL_CIRCUIT_CONGESTION'
}

module.exports = terminationCode => {
  return TerminationCause[terminationCode] || 'UNKNOWN'
}
