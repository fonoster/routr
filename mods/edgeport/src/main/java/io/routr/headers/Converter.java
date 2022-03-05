package io.routr.headers;

import java.text.ParseException;
import java.util.List;
import java.util.ListIterator;

import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.header.Header;

public interface Converter<H extends Header, D extends com.google.protobuf.GeneratedMessageV3> {
  public D fromHeader(H header);

  public H fromDTO(D dto) throws InvalidArgumentException, PeerUnavailableException, ParseException;
}
