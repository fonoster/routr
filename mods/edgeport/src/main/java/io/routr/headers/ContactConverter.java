/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
 *
 * Licensed under the MIT License (the "License");
 * you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *    https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.routr.headers;

import gov.nist.javax.sip.header.Contact;

import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.header.HeaderFactory;
import java.text.ParseException;

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
