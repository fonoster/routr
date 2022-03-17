package io.routr;

import static org.junit.Assert.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import java.text.ParseException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.address.AddressFactory;
import javax.sip.header.HeaderFactory;
import javax.sip.message.MessageFactory;
import javax.sip.message.Request;
import javax.sip.message.Response;
import javax.sip.header.ExtensionHeader;
import javax.sip.header.Header;
import gov.nist.javax.sip.header.Via;
import gov.nist.javax.sip.header.WWWAuthenticate;
import gov.nist.javax.sip.header.Authorization;
import gov.nist.javax.sip.header.CallID;
import gov.nist.javax.sip.header.Contact;
import gov.nist.javax.sip.header.ContentLength;
import gov.nist.javax.sip.header.From;
import gov.nist.javax.sip.header.To;
import javax.sip.address.SipURI;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.HostAccess;
import org.graalvm.polyglot.Value;
import org.graalvm.polyglot.proxy.ProxyObject;
import org.junit.Ignore;
import org.junit.jupiter.api.Test;

import io.routr.headers.AddressConverter;
import io.routr.headers.AuthorizationConverter;
import io.routr.headers.CallIDConverter;
import io.routr.headers.ContactConverter;
import io.routr.headers.ContentLengthConverter;
import io.routr.headers.ExtensionConverter;
import io.routr.headers.FromConverter;
import io.routr.headers.MessageConverter;
import io.routr.headers.ViaConverter;
import io.routr.headers.WWWAuthenticateConverter;
import io.routr.message.*;
import io.routr.common.*;
import io.routr.processor.*;
import io.routr.headers.SipURIConverter;
import io.routr.headers.ToConverter;

public class ConveterTests {

  @Test
  public void testPassingConfig() {
    Context polyglot = Context
        .newBuilder()
        .allowExperimentalOptions(true)
        .allowHostAccess(HostAccess.ALL)
        .allowCreateThread(true)
        .option("js.nashorn-compat", "true")
        .allowExperimentalOptions(true)
        .allowIO(true)
        .allowAllAccess(true).build();

    Map<String, Object> v = polyglot.eval("js", "({person: { name: \"John Doe\"} })").as(Map.class);
    MapProxyObject values = new MapProxyObject(v);

    assertEquals("John Doe", (((MapProxyObject) values.getMember("person")).getMember("name")));
  }

  @Test
  public void testGetSenderMethod() throws PeerUnavailableException, ParseException, InvalidArgumentException {
    HeaderFactory headerFactory = SipFactory.getInstance().createHeaderFactory();
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();
    Request request = messageFactory.createRequest(
        "INVITE sip:sip.target;transport=tcp SIP/2.0\r\n\r\n");
    request.addHeader(headerFactory.createViaHeader("sip.local", 5060, "tcp", null));

    NetInterface sender = MessageConverter.getSender(request);

    assertEquals(5060, sender.getPort());
    assertEquals("sip.local", sender.getHost());
    assertEquals(Transport.TCP, sender.getTransport());
  }

  @Test
  public void testCallIdConveter() throws PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    CallID header = (CallID) factory.createCallIdHeader("call001");
    CallIDConverter converter = new CallIDConverter();
    io.routr.message.CallID callIdDTO = converter.fromHeader(header);
    CallID headerFromDto = converter.fromDTO(callIdDTO);

    assertEquals("call001", header.getCallId());
    assertEquals(callIdDTO.getCallId(), header.getCallId());
    assertEquals(headerFromDto.getCallId(), header.getCallId());
  }

  @Test
  public void testSipURIConveter() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    AddressFactory factory = SipFactory.getInstance().createAddressFactory();

    SipURI uri = (SipURI) factory.createAddress("sip:1001@sip.local").getURI();
    uri.setUserPassword("1234");
    uri.setTransportParam("wss");
    uri.setMAddrParam("test.acmepacket.com");
    uri.setMethodParam("ack");
    uri.setUserParam("john");
    uri.setTTLParam(1000);
    uri.setLrParam();
    uri.setSecure(true);

    SipURIConverter converter = new SipURIConverter();

    io.routr.message.SipURI dto = converter.fromObject(uri);
    SipURI objectFromDto = converter.fromDTO(dto);

    assertEquals(objectFromDto.getUser(), dto.getUser());
    assertEquals(objectFromDto.getHost(), dto.getHost());
    assertEquals(objectFromDto.getUserPassword(), dto.getUserPassword());
    assertEquals(objectFromDto.getTransportParam(), dto.getTransportParam());
    assertEquals(objectFromDto.getMethodParam(), dto.getMethodParam());
    assertEquals(objectFromDto.getUserParam(), dto.getUserParam());
    assertEquals(objectFromDto.getTTLParam(), dto.getTTLParam());
    assertEquals(objectFromDto.getPort(), dto.getPort());
    assertEquals(objectFromDto.hasLrParam(), dto.getLrParam());
    assertEquals(objectFromDto.isSecure(), dto.getSecure());
  }

  @Test
  public void testAddressConveter() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    AddressFactory factory = SipFactory.getInstance().createAddressFactory();
    AddressConverter converter = new AddressConverter();
    javax.sip.address.Address address = factory.createAddress("sip:1001@sip.local");
    address.setDisplayName("John Doe");

    io.routr.message.Address dto = converter.fromObject(address);
    javax.sip.address.Address objectFromDto = converter.fromDTO(dto);

    assertEquals(objectFromDto.getDisplayName(), dto.getDisplayName());
    assertNotNull(objectFromDto.getURI());
  }

/**
 *   public io.routr.message.From fromHeader(From header) {
    var builder = io.routr.message.From.newBuilder();
    var addressConverter = new AddressConverter();
    if (header.getTag() != null) builder.setTag(header.getTag());
    return builder.setAddress(addressConverter.fromObject(header.getAddress())).build();
  }

  @Override
  public From fromDTO(io.routr.message.From dto) throws InvalidArgumentException, PeerUnavailableException, ParseException {
    var addressConverter = new AddressConverter();
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return (From) factory.createFromHeader(addressConverter.fromDTO(dto.getAddress()), dto.getTag());
  }
 */

  @Test
  public void testFromConveter() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    AddressFactory addressFactory = SipFactory.getInstance().createAddressFactory();
    FromConverter converter = new FromConverter();

    var address = addressFactory.createAddress("sip:1001@sip.local");
    From from = (From) factory.createFromHeader(address, "1001");
  
    io.routr.message.From dto = converter.fromHeader(from);
    From objectFromDto = converter.fromDTO(dto);

    assertEquals(objectFromDto.getTag(), dto.getTag());
    assertNotNull(objectFromDto.getAddress());
  }

  @Test
  public void testToConveter() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    AddressFactory addressFactory = SipFactory.getInstance().createAddressFactory();
    ToConverter converter = new ToConverter();

    var address = addressFactory.createAddress("sip:1001@sip.local");
    To to = (To) factory.createToHeader(address, "1001");
  
    io.routr.message.To dto = converter.fromHeader(to);
    To objectToDto = converter.fromDTO(dto);

    assertEquals(objectToDto.getTag(), dto.getTag());
    assertNotNull(objectToDto.getAddress());
  }

  @Test
  public void testContactConveter() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    AddressFactory addressFactory = SipFactory.getInstance().createAddressFactory();
    ContactConverter converter = new ContactConverter();

    var address = addressFactory.createAddress("sip:1001@sip.local");
    Contact contact = (Contact) factory.createContactHeader(address);
  
    io.routr.message.Contact dto = converter.fromHeader(contact);
    Contact objectContactDto = converter.fromDTO(dto);

    assertEquals(objectContactDto.getExpires(), dto.getExpires());
    assertEquals(objectContactDto.getQValue(), dto.getQValue());
    assertNotNull(objectContactDto.getAddress());
  }

  @Test
  public void testContentLengthConveter() throws PeerUnavailableException,
      ParseException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    ContentLength header = (ContentLength) factory.createContentLengthHeader(200);
    ContentLengthConverter converter = new ContentLengthConverter();
    io.routr.message.ContentLength contentLengthDTO = converter.fromHeader(header);
    ContentLength headerFromDto = converter.fromDTO(contentLengthDTO);

    assertEquals(200, header.getContentLength());
    assertEquals(contentLengthDTO.getContentLength(), header.getContentLength());
    assertEquals(headerFromDto.getContentLength(), header.getContentLength());
  }

  @Test
  public void testViaConveter() throws PeerUnavailableException,
      ParseException, InvalidArgumentException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    ViaConverter converter = new ViaConverter();
    Via header = (Via) factory.createViaHeader("sip.local", 5060, "tcp", null);
    io.routr.message.Via viaDTO = converter.fromHeader(header);
    Via headerFromDto = converter.fromDTO(viaDTO);

    assertEquals("sip.local", header.getHost());
    assertEquals(viaDTO.getHost(), header.getHost());
    assertEquals(headerFromDto.getHost(), header.getHost());
  }

  @Test
  public void testWWWAuthenticationConveter() throws PeerUnavailableException,
      ParseException, InvalidArgumentException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    WWWAuthenticateConverter converter = new WWWAuthenticateConverter();
    WWWAuthenticate header = (WWWAuthenticate) factory.createWWWAuthenticateHeader("Digest");
    header.setRealm("sip.local");
    header.setDomain("sip.local");
    header.setNonce("1234");
    header.setAlgorithm("md5");
    header.setQop("auth");
    header.setOpaque("");

    io.routr.message.WWWAuthenticate authenticateDTO = converter.fromHeader(header);
    WWWAuthenticate headerFromDto = converter.fromDTO(authenticateDTO);

    assertEquals(header.getScheme(), headerFromDto.getScheme());
    assertEquals(header.getDomain(), headerFromDto.getDomain());
    assertEquals(header.getRealm(), headerFromDto.getRealm());
    assertEquals(header.getAlgorithm(), headerFromDto.getAlgorithm());
    assertEquals(header.getQop(), headerFromDto.getQop());
    assertEquals(header.getNonce(), headerFromDto.getNonce());
    assertEquals(header.getOpaque(), headerFromDto.getOpaque());
  }

  @Test
  public void testAuthorizationConveter() throws PeerUnavailableException,
      ParseException, InvalidArgumentException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    AuthorizationConverter converter = new AuthorizationConverter();
    Authorization header = (Authorization) factory.createAuthorizationHeader("Digest");
    AddressFactory addrFactory = SipFactory.getInstance().createAddressFactory();

    header.setRealm("sip.local");
    // header.setDomain("sip.remote");
    header.setNonce("1111");
    header.setCNonce("4321");
    header.setNonceCount(1);
    header.setAlgorithm("md5");
    header.setQop("auth");
    header.setOpaque("");
    header.setResponse("1234");
    header.setUsername("1001");
    header.setURI(addrFactory.createURI("sip:17778901246@callcentric.co;transport=UDP"));

    io.routr.message.Authorization authorizationDTO = converter.fromHeader(header);
    Authorization headerFromDto = converter.fromDTO(authorizationDTO);

    assertEquals(header.getScheme(), headerFromDto.getScheme());
    // assertEquals("sip.remote", headerFromDto.getDomain());
    assertEquals(header.getRealm(), headerFromDto.getRealm());
    assertEquals(header.getAlgorithm(), headerFromDto.getAlgorithm());
    assertEquals(header.getQop(), headerFromDto.getQop());
    assertEquals(header.getOpaque(), headerFromDto.getOpaque());
    assertEquals(header.getResponse(), headerFromDto.getResponse());
    assertEquals(header.getCNonce(), headerFromDto.getCNonce());
    assertEquals(header.getNonce(), headerFromDto.getNonce());
    assertEquals(header.getUsername(), headerFromDto.getUsername());
    assertEquals(header.getURI(), headerFromDto.getURI());
    assertEquals(1, headerFromDto.getNonceCount());
  }

  @Test
  public void testExtensionConveter() throws PeerUnavailableException,
      ParseException, InvalidArgumentException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    ExtensionConverter converter = new ExtensionConverter();
    ExtensionHeader header = (ExtensionHeader) factory.createHeader("X-Custom-Header", "my custom header");
    io.routr.message.Extension dto = converter.fromHeader(header);
    ExtensionHeader headerFromDto = (ExtensionHeader) converter.fromDTO(dto);

    assertEquals("X-Custom-Header", header.getName());
    assertEquals(dto.getName(), header.getName());
    assertEquals(dto.getValue(), header.getValue());
    assertEquals(headerFromDto.getName(), header.getName());
    assertEquals(headerFromDto.getValue(), header.getValue());
  }

  @Test
  public void testRequestConvertion() throws Exception {
    HeaderFactory headerFactory = SipFactory.getInstance().createHeaderFactory();
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();

    var via1 = headerFactory.createViaHeader("sip.local.hop1", 5060, "tcp", null);
    via1.setBranch("1234");

    Request request = messageFactory.createRequest(
        "REGISTER sip:sip.local;transport=tcp SIP/2.0\r\n\r\n");
    request.addHeader(headerFactory.createCallIdHeader("call001"));
    request.addHeader(headerFactory.createContentLengthHeader(200));
    request.addHeader(headerFactory.createHeader("X-Custom-Header-01", "my custom header 01"));
    request.addHeader(headerFactory.createHeader("X-Custom-Header-02", "my custom header 02"));
    request.addHeader(via1);
    request.addHeader(headerFactory.createViaHeader("sip.local.hop1", 5060, "tcp", null));
    request.addHeader(headerFactory.createAllowHeader("INVITE"));
    request.addHeader(headerFactory.createAllowHeader("BYE"));

    SIPMessage message = MessageConverter.convertToMessageDTO(request);

    assertEquals(message.getCallId().getCallId(), "call001");
    assertEquals(message.getContentLength().getContentLength(), 200);
    assertEquals(message.getExtensionsCount(), 3);
    assertEquals(message.getExtensions(0).getName(), "X-Custom-Header-01");
    assertEquals(message.getExtensions(0).getValue(), "my custom header 01");
    assertEquals(message.getExtensions(1).getName(), "X-Custom-Header-02");
    assertEquals(message.getExtensions(1).getValue(), "my custom header 02");
    assertEquals(message.getExtensions(2).getName(), "Allow");

    // ? Why 1 and not 0?
    assertEquals(message.getViaList().get(1).getBranch(), via1.getBranch());
    assertEquals(message.getViaList().get(1).getTransport(), via1.getTransport());

    // WARNINIG: Extensions are not considered repeteable, which causes us only
    // getting
    // the first occurrence of the header (e.g INVITE was added but BYE wasnt)
    // That means that we have to implement a converter for ALL repeateable headers.
    assertEquals(message.getExtensions(2).getValue(), "INVITE");

    // assertEquals(message.getRequestUri().getUser(), null);
    assertEquals(message.getRequestUri().getHost(), "sip.local");
    assertEquals(message.getRequestUri().getTransportParam(), "tcp");
  }

  @Test
  public void testResponseConvertion() throws Exception {
    HeaderFactory headerFactory = SipFactory.getInstance().createHeaderFactory();
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();

    var via1 = headerFactory.createViaHeader("sip.local.hop1", 5060, "tcp", null);
    via1.setBranch("1234");

    Response response = messageFactory.createResponse(
        "SIP/2.0 401 Unauthorized\r\n\r\n");
    response.addHeader(headerFactory.createCallIdHeader("call001"));
    response.addHeader(headerFactory.createHeader("X-Custom-Header", "my custom header"));
    response.addHeader(via1);
    response.addHeader(headerFactory.createViaHeader("sip.local.hop2", 5060, "tcp", null));

    SIPMessage message = MessageConverter.convertToMessageDTO(response);

    assertEquals(message.getResponseType(), ResponseType.UNAUTHORIZED);
    assertEquals(message.getCallId().getCallId(), "call001");
    assertEquals(message.getExtensionsCount(), 1);
    assertEquals(message.getExtensions(0).getName(), "X-Custom-Header");
    assertEquals(message.getExtensions(0).getValue(), "my custom header");

    // ? Why 1 and not 0?
    assertEquals(message.getViaList().get(1).getBranch(), via1.getBranch());
    assertEquals(message.getViaList().get(1).getTransport(), via1.getTransport());
  }

  @Test
  public void testCreateHeaderFromMessage() throws Exception {
    HeaderFactory headerFactory = SipFactory.getInstance().createHeaderFactory();
    AddressFactory addressFactory = SipFactory.getInstance().createAddressFactory();
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();
    Request request = messageFactory.createRequest(
        "REGISTER sip:sip.local;transport=tcp SIP/2.0\r\n\r\n");

    var fromAddress = addressFactory.createAddress("sip:1001@sip.local");
    var toAddress = addressFactory.createAddress("sip:1001@sip.local");

    request.addHeader(headerFactory.createFromHeader(fromAddress, "xx1"));
    request.addHeader(headerFactory.createToHeader(toAddress, "xx2"));
    request.addHeader(headerFactory.createCallIdHeader("call001"));
    request.addHeader(headerFactory.createContentLengthHeader(200));
    request.addHeader(headerFactory.createHeader("X-Custom-Header-01", "my custom header 01"));
    request.addHeader(headerFactory.createHeader("X-Custom-Header-02", "my custom header 02"));
    request.addHeader(headerFactory.createViaHeader("sip.local.hop1", 5060, "tcp", null));
    request.addHeader(headerFactory.createViaHeader("sip.local.hop2", 5060, "tcp", null));
    request.addHeader(headerFactory.createAllowHeader("INVITE"));
    request.addHeader(headerFactory.createAllowHeader("BYE"));

    SIPMessage message = MessageConverter.convertToMessageDTO(request);
    List<Header> headers = MessageConverter.createHeadersFromMessage(message);
    assertEquals(10, headers.size());
  }

}
