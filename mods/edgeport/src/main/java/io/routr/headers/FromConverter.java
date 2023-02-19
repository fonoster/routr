/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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

import gov.nist.javax.sip.header.From;

import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.header.HeaderFactory;
import java.text.ParseException;
import java.util.Iterator;

@ProtoMapping(header = From.class, field = "from", repeatable = false, extension = false)
public class FromConverter implements Converter<From, io.routr.message.From> {
  @Override
  public io.routr.message.From fromHeader(From header) {
    var builder = io.routr.message.From.newBuilder();
    var addressConverter = new AddressConverter();
    Iterator<String> i = header.getParameterNames();
    while (i.hasNext()) {
      String key = i.next();
      builder.putParameters(key, header.getParameter(key));
    }
    if (header.getTag() != null)
      builder.setTag(header.getTag());
    return builder.setAddress(addressConverter.fromObject(header.getAddress())).build();
  }

  @Override
  public From fromDTO(io.routr.message.From dto)
    throws InvalidArgumentException, PeerUnavailableException, ParseException {
    var addressConverter = new AddressConverter();
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();

    if (dto.getTag().isEmpty()) {
      throw new InvalidArgumentException("the From header must contain the tag parameter");
    }

    From from = (From) factory.createFromHeader(addressConverter.fromDTO(dto.getAddress()), dto.getTag());

    Iterator<String> i = dto.getParametersMap().keySet().iterator();

    while (i.hasNext()) {
      String key = i.next();
      from.setParameter(key, dto.getParametersMap().get(key));
    }
    return from;
  }
}
