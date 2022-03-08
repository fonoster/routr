package io.routr.headers;

import java.text.ParseException;
import javax.sip.header.HeaderFactory;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.CallID;

@ProtoMapping(header = CallID.class, field = "call_id", repeatable = false, extension = false)
public class CallIDConverter implements Converter<CallID, io.routr.CallID> {
  @Override
  public io.routr.CallID fromHeader(CallID header) {
    return io.routr.CallID.newBuilder().setCallId(header.getCallId()).build();
  }

  @Override
  public CallID fromDTO(io.routr.CallID dto) throws PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return (CallID) factory.createCallIdHeader(dto.getCallId());
  }
}
