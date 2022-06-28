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

import java.text.ParseException;
import java.util.Iterator;

import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.RecordRoute;

@ProtoMapping(header = RecordRoute.class, field = "record_route", repeatable = true, extension = false)
public class RecordRouteConverter implements Converter<RecordRoute, io.routr.message.RecordRoute> {
  @Override
  public io.routr.message.RecordRoute fromHeader(RecordRoute header) {
    var builder = io.routr.message.RecordRoute.newBuilder();
    var addressConverter = new AddressConverter();
    Iterator<String> i = header.getParameterNames();
    while (i.hasNext()) {
      String key = i.next();
      builder.putParameters(key, header.getParameter(key));
    }
    return builder.setAddress(addressConverter.fromObject(header.getAddress())).build();
  }

  @Override
  public RecordRoute fromDTO(io.routr.message.RecordRoute dto) throws InvalidArgumentException, PeerUnavailableException, ParseException {
    var addressConverter = new AddressConverter();
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    RecordRoute recordRoute = (RecordRoute) factory.createRecordRouteHeader(addressConverter.fromDTO(dto.getAddress()));
    for (String key : dto.getParametersMap().keySet()) {
      recordRoute.setParameter(key, dto.getParametersMap().get(key));
    }
    return recordRoute;
  }
}
