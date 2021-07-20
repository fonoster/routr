/**
 * @author Pedro Sanders
 * @since v1
 *
 * Sip provider for Registry module
 */
const defBindAddr = () => {
  const InetAddress = Java.type('java.net.InetAddress')
  return InetAddress.getLocalHost()
    .getHostAddress()
    .toString()
}
const defPort = () => Math.floor(Math.random() * 6000) + 5080

module.exports = (properties, bindAddr = defBindAddr(), port = defPort()) => {
  const SipFactory = Java.type('javax.sip.SipFactory')
  const sipFactory = SipFactory.getInstance()
  sipFactory.setPathName('gov.nist')

  const sipStack = sipFactory.createSipStack(properties)
  const lpTCP = sipStack.createListeningPoint(bindAddr, port, 'tcp')
  const lpTLS = sipStack.createListeningPoint(bindAddr, port + 1, 'tls')
  const lpUDP = sipStack.createListeningPoint(bindAddr, port, 'udp')
  const sipProvider = sipStack.createSipProvider(lpTCP)
  sipProvider.addListeningPoint(lpTLS)
  sipProvider.addListeningPoint(lpUDP)

  return sipProvider
}
