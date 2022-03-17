package io.routr.headers;

import java.text.ParseException;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.address.Address;
import javax.sip.address.AddressFactory;
import javax.sip.address.SipURI;
import javax.sip.address.URI;

public class AddressConverter {
  public io.routr.message.Address fromObject(Address address) {
    var builder = io.routr.message.Address.newBuilder();
    var sipUriConverter = new SipURIConverter();
    if (address.getDisplayName() != null) builder.setDisplayName(address.getDisplayName());
    builder.setWildcard(address.isWildcard());
    builder.setUri(sipUriConverter.fromObject((SipURI) address.getURI()));
    return builder.build();
  }

  public Address fromDTO(io.routr.message.Address dto) throws PeerUnavailableException, InvalidArgumentException, ParseException  {
    var sipUriConverter = new SipURIConverter();
    AddressFactory factory = SipFactory.getInstance().createAddressFactory();
    Address address = factory.createAddress((URI) sipUriConverter.fromDTO(dto.getUri()));
    address.setDisplayName(dto.getDisplayName());
    return address;
  }
}
