/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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

import gov.nist.javax.sip.header.ContentLength;

import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.header.HeaderFactory;
import java.text.ParseException;

@ProtoMapping(header = ContentLength.class, field = "content_length", repeatable = false, extension = false)
public class ContentLengthConverter implements Converter<ContentLength, io.routr.message.ContentLength> {
  @Override
  public io.routr.message.ContentLength fromHeader(ContentLength header) {
    return io.routr.message.ContentLength.newBuilder().setContentLength(header.getContentLength()).build();
  }

  @Override
  public ContentLength fromDTO(io.routr.message.ContentLength dto)
    throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    return (ContentLength) factory.createContentLengthHeader(dto.getContentLength());
  }
}
