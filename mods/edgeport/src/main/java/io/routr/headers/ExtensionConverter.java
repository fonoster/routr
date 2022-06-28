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

import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.header.ExtensionHeader;
import javax.sip.header.Header;
import javax.sip.header.HeaderFactory;
import java.text.ParseException;

@ProtoMapping(header = ExtensionHeader.class, field = "extensions", repeatable = false, extension = true)
public class ExtensionConverter implements Converter<Header, io.routr.message.Extension> {
  @Override
  public io.routr.message.Extension fromHeader(Header header) {
    if (header instanceof ExtensionHeader) {
      return io.routr.message.Extension.newBuilder()
        .setName(header.getName())
        .setValue(((ExtensionHeader) header).getValue())
        .build();
    } else {
      return io.routr.message.Extension.newBuilder()
        .setName(header.getName())
        .setValue(header.toString().split(header.getName() + ":")[1].trim())
        .build();
    }
  }

  @Override
  public Header fromDTO(io.routr.message.Extension dto)
    throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return factory.createHeader(dto.getName(), dto.getValue());
  }
}
