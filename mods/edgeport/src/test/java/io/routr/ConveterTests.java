package io.routr;

import static org.junit.Assert.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.address.AddressFactory;
import javax.sip.address.SipURI;
import javax.sip.header.ExtensionHeader;
import javax.sip.header.Header;
import javax.sip.header.HeaderFactory;
import javax.sip.message.MessageFactory;
import javax.sip.message.Request;
import javax.sip.message.Response;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.HostAccess;
import org.junit.jupiter.api.Test;

import gov.nist.javax.sip.header.Allow;
import gov.nist.javax.sip.header.Authorization;
import gov.nist.javax.sip.header.CallID;
import gov.nist.javax.sip.header.Contact;
import gov.nist.javax.sip.header.ContentLength;
import gov.nist.javax.sip.header.Expires;
import gov.nist.javax.sip.header.From;
import gov.nist.javax.sip.header.MaxForwards;
import gov.nist.javax.sip.header.RecordRoute;
import gov.nist.javax.sip.header.Route;
import gov.nist.javax.sip.header.To;
import gov.nist.javax.sip.header.Via;
import gov.nist.javax.sip.header.WWWAuthenticate;
import io.routr.common.Transport;
import io.routr.headers.AddressConverter;
import io.routr.headers.AuthorizationConverter;
import io.routr.headers.CallIDConverter;
import io.routr.headers.ContactConverter;
import io.routr.headers.ContentLengthConverter;
import io.routr.headers.ExpiresConverter;
import io.routr.headers.ExtensionConverter;
import io.routr.headers.FromConverter;
import io.routr.headers.MaxForwardsConverter;
import io.routr.headers.MessageConverter;
import io.routr.headers.RecordRouteConverter;
import io.routr.headers.RouteConverter;
import io.routr.headers.SipURIConverter;
import io.routr.headers.ToConverter;
import io.routr.headers.ViaConverter;
import io.routr.headers.WWWAuthenticateConverter;
import io.routr.message.ResponseType;
import io.routr.message.SIPMessage;
import io.routr.processor.NetInterface;

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
  public void testExpiresConveter() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    Expires header = (Expires) factory.createExpiresHeader(600);
    ExpiresConverter converter = new ExpiresConverter();
    io.routr.message.Expires expiresDTO = converter.fromHeader(header);
    Expires headerFromDto = converter.fromDTO(expiresDTO);

    assertEquals(600, header.getExpires());
    assertEquals(expiresDTO.getExpires(), header.getExpires());
    assertEquals(headerFromDto.getExpires(), header.getExpires());
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
    assertEquals(objectFromDto.getTTLParam(), dto.getTtlParam());
    assertEquals(objectFromDto.getPort(), dto.getPort());
    assertEquals(objectFromDto.hasLrParam(), dto.getLrParam());
    assertEquals(objectFromDto.isSecure(), dto.getSecure());
  }

  @Test
  public void testSipURIConveterWithNull() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    AddressFactory factory = SipFactory.getInstance().createAddressFactory();

    SipURI uri = (SipURI) factory.createAddress("sip:sip.local").getURI();
    SipURIConverter converter = new SipURIConverter();
    io.routr.message.SipURI dto = converter.fromObject(uri);
    SipURI objectFromDto = converter.fromDTO(dto);
    assertEquals(objectFromDto.getUser(), null);
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

  @Test
  public void testFromConveter() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    AddressFactory addressFactory = SipFactory.getInstance().createAddressFactory();
    FromConverter converter = new FromConverter();

    var address = addressFactory.createAddress("sip:1001@sip.local");
    address.setDisplayName("John Doe");
    From from = (From) factory.createFromHeader(address, "1001");
    from.setParameter("a", "1");
    from.setParameter("b", "2");

    io.routr.message.From dto = converter.fromHeader(from);
    From objectFromDto = converter.fromDTO(dto);

    assertEquals(objectFromDto.getTag(), dto.getTag());
    assertNotNull(objectFromDto.getAddress());
    assertEquals(objectFromDto.getAddress().getDisplayName(), 
      dto.getAddress().getDisplayName());
    assertEquals(((SipURI)objectFromDto.getAddress().getURI()).getUser(),
      dto.getAddress().getUri().getUser());
    assertEquals(((SipURI)objectFromDto.getAddress().getURI()).getHost(),
      dto.getAddress().getUri().getHost());
    assertEquals(false, dto.getAddress().getUri().getSecure());
    assertEquals(false, dto.getAddress().getWildcard());
    assertEquals(objectFromDto.getParameter("a"), from.getParameter("a"));
    assertEquals(objectFromDto.getParameter("b"), from.getParameter("b"));
  }

  @Test
  public void testToConveter() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    AddressFactory addressFactory = SipFactory.getInstance().createAddressFactory();
    ToConverter converter = new ToConverter();

    var address = addressFactory.createAddress("sip:1001@sip.local");
    address.setDisplayName("John Doe");
    To to = (To) factory.createToHeader(address, "1001");
    to.setParameter("a", "1");
    to.setParameter("b", "2");

    io.routr.message.To dto = converter.fromHeader(to);
    To objectToDto = converter.fromDTO(dto);

    assertEquals(objectToDto.getTag(), dto.getTag());
    assertNotNull(objectToDto.getAddress());
    assertEquals(objectToDto.getAddress().getDisplayName(), 
      dto.getAddress().getDisplayName());
    assertEquals(((SipURI)objectToDto.getAddress().getURI()).getUser(),
      dto.getAddress().getUri().getUser());
    assertEquals(((SipURI)objectToDto.getAddress().getURI()).getHost(),
      dto.getAddress().getUri().getHost());
    assertEquals(false, dto.getAddress().getUri().getSecure());
    assertEquals(false, dto.getAddress().getWildcard());
    assertEquals(objectToDto.getParameter("a"), to.getParameter("a"));
    assertEquals(objectToDto.getParameter("b"), to.getParameter("b"));
  }

  @Test
  public void testRouteConveter() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    AddressFactory addressFactory = SipFactory.getInstance().createAddressFactory();
    RouteConverter converter = new RouteConverter();

    var address = addressFactory.createAddress("sip:sip.local");
    Route route = (Route) factory.createRouteHeader(address);
    route.setParameter("a", "1");
    route.setParameter("b", "2");

    io.routr.message.Route dto = converter.fromHeader(route);
    Route objectRouteDto = converter.fromDTO(dto);

    assertNotNull(objectRouteDto.getAddress());
    assertEquals(objectRouteDto.getParameter("a"), route.getParameter("a"));
    assertEquals(objectRouteDto.getParameter("b"), route.getParameter("b"));
    assertEquals(((SipURI)objectRouteDto.getAddress().getURI()).getHost(),
      dto.getAddress().getUri().getHost());
  }

  @Test
  public void testRecordRouteConveter() throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    AddressFactory addressFactory = SipFactory.getInstance().createAddressFactory();
    RecordRouteConverter converter = new RecordRouteConverter();

    var address = addressFactory.createAddress("sip:sip.local");
    RecordRoute recordRoute = (RecordRoute) factory.createRecordRouteHeader(address);
    recordRoute.setParameter("a", "1");
    recordRoute.setParameter("b", "2");

    io.routr.message.RecordRoute dto = converter.fromHeader(recordRoute);
    RecordRoute objectRecordRouteDto = converter.fromDTO(dto);

    assertNotNull(objectRecordRouteDto.getAddress());
    assertEquals(objectRecordRouteDto.getParameter("a"), recordRoute.getParameter("a"));
    assertEquals(objectRecordRouteDto.getParameter("b"), recordRoute.getParameter("b"));
    assertEquals(((SipURI)objectRecordRouteDto.getAddress().getURI()).getHost(),
      dto.getAddress().getUri().getHost());
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
  public void testMaxForwardsConveter() throws PeerUnavailableException,
      ParseException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    MaxForwards header = (MaxForwards) factory.createMaxForwardsHeader(70);
    MaxForwardsConverter converter = new MaxForwardsConverter();
    io.routr.message.MaxForwards maxForwardsDTO = converter.fromHeader(header);
    MaxForwards headerFromDto = converter.fromDTO(maxForwardsDTO);

    assertEquals(70, header.getMaxForwards());
    assertEquals(maxForwardsDTO.getMaxForwards(), header.getMaxForwards());
    assertEquals(headerFromDto.getMaxForwards(), header.getMaxForwards());
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
    header.setURI(addrFactory.createURI("sip:100@sip.local;transport=UDP"));

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
    request.addHeader(headerFactory.createHeader("X-Gateway-Auth", "dXNlcjpwYXNzd29yZA=="));
    request.addHeader(headerFactory.createViaHeader("sip.local.hop1", 5060, "tcp", null));
    request.addHeader(headerFactory.createViaHeader("sip.local.hop2", 5060, "tcp", null));
    request.addHeader(headerFactory.createViaHeader("sip.local.hop3", 5060, "tcp", null));
    request.addHeader(headerFactory.createAllowHeader("INVITE"));
    request.addHeader(headerFactory.createAllowHeader("BYE"));

    SIPMessage message = MessageConverter.convertToMessageDTO(request);
    List<Header> headers = MessageConverter.createHeadersFromMessage(message);

    var requestOut = GRPCSipListener.updateRequest(request, headers);

    Iterator<Via> viaIterator = request.getHeaders(Via.NAME);
    ArrayList<Via> viaList = new ArrayList<Via>();

    while (viaIterator.hasNext()) {
      // Print headers to log
      viaList.add(viaIterator.next());
    }

    Iterator<Via> viaIteratorOut = requestOut.getHeaders(Via.NAME);
    ArrayList<Via> viaListOut = new ArrayList<Via>();

    while (viaIteratorOut.hasNext()) {
      // Print headers to log
      viaListOut.add(viaIteratorOut.next());
    }

    assertEquals(10, headers.size());
    
    Iterator names = request.getHeaderNames();
    while (names.hasNext()) {
      String n = (String) names.next();
      
      // TODO: We need to create a converter for this header
      if (!n.equals(Allow.NAME)) {
        assertEquals(request.getHeader(n).toString(), request.getHeader(n).toString());
      }
    }
    assertEquals(viaList.get(0).getHost(), viaListOut.get(0).getHost());
    assertEquals(viaList.get(1).getHost(), viaListOut.get(1).getHost());
    assertEquals(viaList.get(2).getHost(), viaListOut.get(2).getHost());
    assertEquals(requestOut.getHeader("X-Gateway-Auth"), null);
  }
}
