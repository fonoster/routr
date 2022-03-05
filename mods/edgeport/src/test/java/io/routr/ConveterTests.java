package io.routr;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.text.ParseException;

import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.header.HeaderFactory;
import javax.sip.message.MessageFactory;
import javax.sip.message.Request;
import org.junit.jupiter.api.Test;

import javax.sip.header.ExtensionHeader;
import gov.nist.javax.sip.header.Via;
import gov.nist.javax.sip.header.CallID;
import gov.nist.javax.sip.header.ContentLength;
import io.routr.headers.CallIDConverter;
import io.routr.headers.ContentLengthConverter;
import io.routr.headers.ExtensionConverter;
import io.routr.headers.MessageConverter;
import io.routr.headers.ViaConverter;

public class ConveterTests {
  @Test
  public void testCallIdConveter() throws PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    CallID header = (CallID) factory.createCallIdHeader("call001");
    CallIDConverter converter = new CallIDConverter();
    io.routr.CallID callIdDTO = converter.fromHeader(header);
    CallID headerFromDto = converter.fromDTO(callIdDTO);

    assertEquals("call001", header.getCallId());
    assertEquals(callIdDTO.getCallId(), header.getCallId());
    assertEquals(headerFromDto.getCallId(), header.getCallId());
  }

  @Test
  public void testContentLengthConveter() throws PeerUnavailableException,
      ParseException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    ContentLength header = (ContentLength) factory.createContentLengthHeader(200);
    ContentLengthConverter converter = new ContentLengthConverter();
    io.routr.ContentLength contentLengthDTO = converter.fromHeader(header);
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
    io.routr.Via viaDTO = converter.fromHeader(header);
    Via headerFromDto = converter.fromDTO(viaDTO);

    assertEquals("sip.local", header.getHost());
    assertEquals(viaDTO.getHost(), header.getHost());
    assertEquals(headerFromDto.getHost(), header.getHost());
  }

  @Test
  public void testExtensionConveter() throws PeerUnavailableException,
      ParseException, InvalidArgumentException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    ExtensionConverter converter = new ExtensionConverter();
    ExtensionHeader header = (ExtensionHeader) factory.createHeader("X-Custom-Header", "my custom header");
    io.routr.Extension dto = converter.fromHeader(header);
    ExtensionHeader headerFromDto = converter.fromDTO(dto);

    assertEquals("X-Custom-Header", header.getName());
    assertEquals(dto.getName(), header.getName());
    assertEquals(dto.getValue(), header.getValue());
    assertEquals(headerFromDto.getName(), header.getName());
    assertEquals(headerFromDto.getValue(), header.getValue());
  }

  @Test
  public void testRequestConveter() throws Exception {
    HeaderFactory headerFactory = SipFactory.getInstance().createHeaderFactory();
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();
    Request request = messageFactory.createRequest(
        "REGISTER sip:sip.local;transport=tcp SIP/2.0\r\n\r\n");
    request.addHeader(headerFactory.createCallIdHeader("call001"));
    request.addHeader(headerFactory.createContentLengthHeader(200));
    request.addHeader(headerFactory.createHeader("X-Custom-Header-01", "my custom header 01"));
    request.addHeader(headerFactory.createHeader("X-Custom-Header-02", "my custom header 02"));
    request.addHeader(headerFactory.createViaHeader("sip.local.hop1", 5060, "tcp", null));
    request.addHeader(headerFactory.createViaHeader("sip.local.hop2", 5060, "tcp", null));
    request.addHeader(headerFactory.createAllowHeader("INVITE"));
    request.addHeader(headerFactory.createAllowHeader("BYE"));

    SIPMessage message = MessageConverter.convertToRequestDTO(request);

    assertEquals(message.getCallId().getCallId(), "call001");
    assertEquals(message.getContentLength().getContentLength(), 200);
    assertEquals(message.getExtensionsCount(), 3);
    assertEquals(message.getExtensions(0).getName(), "X-Custom-Header-01");
    assertEquals(message.getExtensions(0).getValue(), "my custom header 01");
    assertEquals(message.getExtensions(1).getName(), "X-Custom-Header-02");
    assertEquals(message.getExtensions(1).getValue(), "my custom header 02");
    assertEquals(message.getExtensions(2).getName(), "Allow");

    // WARNINIG: Extensions are not considered repeteable, which causes us only getting 
    // the first occurrence of the header (e.g INVITE was added but BYE wasnt)
    // That means that we have to implement a converter for ALL repeateable headers.
    assertEquals(message.getExtensions(2).getValue(), "INVITE");
  }
}
