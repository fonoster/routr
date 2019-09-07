/**
 * @author Pedro Sanders
 * @since v1
 */
const CSeqHeader = Java.type('javax.sip.header.CSeqHeader')
const ViaHeader = Java.type('javax.sip.header.ViaHeader')
const Request = Java.type('javax.sip.message.Request')
const Response = Java.type('javax.sip.message.Response')

const hasCodes = (r, c) => c.filter(code => r.getStatusCode() === code).length > 0
const isMethod = (r, m) => m.filter(method => r.getHeader(CSeqHeader.NAME).getMethod() === method).length > 0
const isOk = r => hasCodes(r, [Response.OK])
const mustAuthenticate = r => hasCodes(r, [Response.PROXY_AUTHENTICATION_REQUIRED, Response.UNAUTHORIZED])
const isStackJob = r => hasCodes(r, [Response.TRYING, Response.REQUEST_TERMINATED]) ||
    isMethod(r, [Request.CANCEL])
const isTransactional = event => event.getClientTransaction() !== null &&
    isMethod(event.getResponse(), [Request.INVITE, Request.MESSAGE])
const isRegister = r => isMethod(r, Request.REGISTER)
const isRegisterOk = r => isOk(r) && isRegister(r)
const isRegisterNok = r => !isOk(r) && isRegister(r)
const isBehindNat = r =>  {
    const v = r.getHeader(ViaHeader.NAME)
    return !v.getHost().equals(v.getReceived()) || v.getPort() !== v.getRPort()
}

module.exports.hasCodes = hasCodes
module.exports.isMethod = isMethod
module.exports.isOk = isOk
module.exports.mustAuthenticate = mustAuthenticate
module.exports.isStackJob = isStackJob
module.exports.isTransactional = isTransactional
module.exports.isRegister = isRegister
module.exports.isRegisterOk = isRegisterOk
module.exports.isRegisterNok = isRegisterNok
module.exports.isBehindNat = isBehindNat
