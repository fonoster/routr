package io.routr.headers;

import java.text.ParseException;
import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.address.AddressFactory;

import gov.nist.javax.sip.header.Authorization;

@ProtoMapping(header = Authorization.class, field = "authorization", repeatable = false, extension = false)
public class AuthorizationConverter implements Converter<Authorization, io.routr.message.Authorization> {

  @Override
  public io.routr.message.Authorization fromHeader(Authorization header) {
    var builder = io.routr.message.Authorization.newBuilder();

    if (header.getScheme() != null) builder.setScheme(header.getScheme());
    if (header.getRealm() != null) builder.setRealm(header.getRealm());
    // if (header.getDomain() != null) builder.setDomain(header.getDomain());
    if (header.getCNonce() != null) builder.setCNonce(header.getCNonce());
    if (header.getNonce() != null) builder.setNonce(header.getNonce());
    if (header.getAlgorithm() != null) builder.setAlgorithm(header.getAlgorithm());
    if (header.getQop() != null) builder.setQop(header.getQop());
    if (header.getOpaque() != null) builder.setOpaque(header.getOpaque());
    if (header.getResponse() != null) builder.setResponse(header.getResponse());
    if (header.getUsername() != null) builder.setUsername(header.getUsername());
    if (header.getURI() != null) builder.setUri(header.getURI().toString());
    
    builder.setNonceCount(header.getNonceCount());

    return builder.build();
  }

  @Override
  public Authorization fromDTO(io.routr.message.Authorization dto)
      throws InvalidArgumentException, PeerUnavailableException, ParseException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    AddressFactory addrFactory = SipFactory.getInstance().createAddressFactory();
    Authorization header = (Authorization) factory.createAuthorizationHeader(dto.getScheme());

    // header.setDomain(dto.getDomain());

    header.setNonceCount(dto.getNonceCount());
    header.setRealm(dto.getRealm());
    header.setOpaque(dto.getOpaque());
    
    if (!dto.getNonce().isEmpty()) header.setNonce(dto.getNonce());
    if (!dto.getCNonce().isEmpty()) header.setCNonce(dto.getCNonce());
    if (!dto.getAlgorithm().isEmpty()) header.setAlgorithm(dto.getAlgorithm());
    if (!dto.getQop().isEmpty()) header.setQop(dto.getQop());
    if (!dto.getResponse().isEmpty()) header.setResponse(dto.getResponse());
    if (!dto.getUsername().isEmpty()) header.setUsername(dto.getUsername());
    if (dto.getUri() != null && !dto.getUri().isEmpty()) {
      header.setURI(addrFactory.createURI(dto.getUri()));
    }
 
    return header;
  }
}
