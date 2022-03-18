package io.routr.headers;

import java.text.ParseException;
import javax.sip.header.HeaderFactory;
import javax.sip.InvalidArgumentException;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import gov.nist.javax.sip.header.From;
import javax.sip.address.Address;
import javax.sip.address.AddressFactory;
import javax.sip.address.SipURI;
import javax.sip.address.SipURI;

public class SipURIConverter {

  public io.routr.message.SipURI fromObject(SipURI uri) {
    var builder = io.routr.message.SipURI.newBuilder();
    builder.setLrParam(uri.hasLrParam());
    builder.setTTLParam(uri.getTTLParam());
    builder.setPort(5060);
    builder.setSecure(uri.isSecure());

    if(uri.getUser() != null) builder.setUser(uri.getUser());
    if(uri.getHost() != null) builder.setHost(uri.getHost());
    if(uri.getUserPassword() != null) builder.setUserPassword(uri.getUserPassword());
    if(uri.getTransportParam() != null) builder.setTransportParam(uri.getTransportParam());
    if(uri.getMethodParam() != null) builder.setMethodParam(uri.getMethodParam());
    if(uri.getUserParam() != null) builder.setUserParam(uri.getUserParam());
    if(uri.getPort() != -1) builder.setPort(uri.getPort());
    if(uri.getTTLParam() != -1) builder.setTTLParam(uri.getTTLParam());
    if(uri.getMethodParam()!= null) builder.setMethodParam(uri.getMethodParam());
 
    return builder.build();
  }

  public SipURI fromDTO(io.routr.message.SipURI dto) throws InvalidArgumentException, PeerUnavailableException, ParseException {
    AddressFactory factory = SipFactory.getInstance().createAddressFactory();
    SipURI uri = (SipURI) factory.createAddress("sip:" + dto.getHost()).getURI();

    if (dto.getLrParam()) uri.setLrParam();
    if(!dto.getUser().isEmpty()) uri.setUser(dto.getUser());
    if(!dto.getHost().isEmpty()) uri.setHost(dto.getHost());
    if(!dto.getUserPassword().isEmpty()) uri.setUserPassword(dto.getUserPassword());
    if(!dto.getTransportParam().isEmpty()) uri.setTransportParam(dto.getTransportParam());
    if(!dto.getMethodParam().isEmpty()) uri.setMethodParam(dto.getMethodParam());
    if(!dto.getUserParam().isEmpty()) uri.setUserParam(dto.getUserParam());
    if(dto.getTTLParam() != -1) uri.setTTLParam(dto.getTTLParam());
    
    uri.setPort(dto.getPort());
    uri.setSecure(dto.getSecure());

    return uri;
  }
}
