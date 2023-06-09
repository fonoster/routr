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

import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.address.AddressFactory;
import javax.sip.address.SipURI;
import java.text.ParseException;

public class SipURIConverter {

  public io.routr.message.SipURI fromObject(SipURI uri) {
    final var builder = io.routr.message.SipURI.newBuilder();
    builder.setLrParam(uri.hasLrParam());
    builder.setTtlParam(uri.getTTLParam());
    builder.setSecure(uri.isSecure());
    builder.setPort(uri.getPort());

    if (uri.getUser() != null) builder.setUser(uri.getUser());
    if (uri.getHost() != null) builder.setHost(uri.getHost());
    if (uri.getUserPassword() != null) builder.setUserPassword(uri.getUserPassword());
    // TODO: Set transport explicitly to avoid routing issues when client doesn't set it
    if (uri.getTransportParam() != null) builder.setTransportParam(uri.getTransportParam());
    if (uri.getMethodParam() != null) builder.setMethodParam(uri.getMethodParam());
    if (uri.getUserParam() != null) builder.setUserParam(uri.getUserParam());
    if (uri.getTTLParam() > 0) builder.setTtlParam(uri.getTTLParam());
    if (uri.getMethodParam() != null) builder.setMethodParam(uri.getMethodParam());
    if (uri.getParameter("bnc") != null) builder.setBncParam(true);

    return builder.build();
  }

  public SipURI fromDTO(io.routr.message.SipURI dto) throws InvalidArgumentException, PeerUnavailableException, ParseException {
    AddressFactory factory = SipFactory.getInstance().createAddressFactory();
    SipURI uri;

    if(dto.getBncParam()) {
      uri = (SipURI) factory.createURI("sip:" + dto.getHost() + ";bnc");
    } else {
      uri = (SipURI) factory.createURI("sip:" + dto.getHost());
    }

    // TODO: Consider generating an error if the User is present in combination with the bnc flag
    if (!dto.getUser().isEmpty()) uri.setUser(dto.getUser());
    if (!dto.getUserParam().isEmpty()) uri.setUserParam(dto.getUserParam());
    if (!dto.getUserPassword().isEmpty()) uri.setUserPassword(dto.getUserPassword());
    if (dto.getLrParam()) uri.setLrParam();
    if (!dto.getHost().isEmpty()) uri.setHost(dto.getHost());
    if (!dto.getTransportParam().isEmpty()) uri.setTransportParam(dto.getTransportParam());
    if (!dto.getMethodParam().isEmpty()) uri.setMethodParam(dto.getMethodParam());
    if (dto.getTtlParam() > 0) uri.setTTLParam(dto.getTtlParam());
    if (dto.getPort() > -1) uri.setPort(dto.getPort());

    uri.setSecure(dto.getSecure());

    return uri;
  }
}
