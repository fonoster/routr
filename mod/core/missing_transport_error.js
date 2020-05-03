/**
 * @author Pedro Sanders
 * @since v1
 */
class MissingTransportError extends Error {
  constructor (proto) {
    super(`Transport \'${proto}\' not found in configs => .spec.transport.[*]`)
    this.name = 'MissingTransportError'
  }
}

module.exports = MissingTransportError
