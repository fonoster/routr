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

import gov.nist.javax.sip.header.WWWAuthenticate;

import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.header.HeaderFactory;
import java.text.ParseException;

@ProtoMapping(header = WWWAuthenticate.class, field = "www_authenticate", repeatable = false, extension = false)
public class WWWAuthenticateConverter implements Converter<WWWAuthenticate, io.routr.message.WWWAuthenticate> {

  @Override
  public io.routr.message.WWWAuthenticate fromHeader(WWWAuthenticate header) {
    var builder = io.routr.message.WWWAuthenticate.newBuilder();

    if (header.getScheme() != null) builder.setScheme(header.getScheme());
    if (header.getRealm() != null) builder.setRealm(header.getRealm());
    if (header.getDomain() != null) builder.setDomain(header.getDomain());
    if (header.getNonce() != null) builder.setNonce(header.getNonce());
    if (header.getAlgorithm() != null) builder.setAlgorithm(header.getAlgorithm());
    if (header.getQop() != null) builder.setQop(header.getQop());
    if (header.getOpaque() != null) builder.setOpaque(header.getOpaque());

    return builder.build();
  }

  @Override
  public WWWAuthenticate fromDTO(io.routr.message.WWWAuthenticate dto)
    throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    WWWAuthenticate header = (WWWAuthenticate) factory.createWWWAuthenticateHeader(dto.getScheme());
    header.setRealm(dto.getRealm());
    header.setDomain(dto.getDomain());
    header.setNonce(dto.getNonce());
    header.setAlgorithm(dto.getAlgorithm());
    header.setQop(dto.getQop());
    header.setOpaque(dto.getOpaque());
    return header;
  }
}
