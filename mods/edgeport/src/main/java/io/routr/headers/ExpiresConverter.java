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

import gov.nist.javax.sip.header.Expires;

import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.header.HeaderFactory;
import java.text.ParseException;

@ProtoMapping(header = Expires.class, field = "expires", repeatable = false, extension = false)
public class ExpiresConverter implements Converter<Expires, io.routr.message.Expires> {
  @Override
  public io.routr.message.Expires fromHeader(Expires header) {
    return io.routr.message.Expires.newBuilder().setExpires(header.getExpires()).build();
  }

  @Override
  public Expires fromDTO(io.routr.message.Expires dto) throws PeerUnavailableException, ParseException, InvalidArgumentException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return (Expires) factory.createExpiresHeader(dto.getExpires());
  }
}
