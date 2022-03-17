package io.routr.headers;

import java.text.ParseException;
import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.Contact;

@ProtoMapping(header = Contact.class, field = "contact", repeatable = false, extension = false)
public class ContactConverter implements Converter<Contact, io.routr.message.Contact> {
  @Override
  public io.routr.message.Contact fromHeader(Contact header) {
    var builder = io.routr.message.Contact.newBuilder();
    var addressConverter = new AddressConverter();

    builder.setExpires(header.getExpires());
    builder.setQValue(header.getQValue());

    return builder.setAddress(addressConverter.fromObject(header.getAddress())).build();
  }

  @Override
  public Contact fromDTO(io.routr.message.Contact dto) throws InvalidArgumentException, PeerUnavailableException, ParseException {
    var addressConverter = new AddressConverter();
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    Contact contact = (Contact) factory.createContactHeader(addressConverter.fromDTO(dto.getAddress()));
    contact.setExpires(dto.getExpires());
    contact.setQValue(dto.getQValue());
    return contact;
  }
}
