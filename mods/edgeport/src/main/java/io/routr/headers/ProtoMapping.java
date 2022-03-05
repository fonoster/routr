package io.routr.headers;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import javax.sip.header.Header;

@Retention(RetentionPolicy.RUNTIME)
public @interface ProtoMapping {
  // Name of the field in proto message
  String field();

  // Header
  Class<? extends Header> header();

  // Indicates that this header my have multiple entries (e.g VIAHeader)
  boolean repeatable();

  // Mapping flag for unrecognize/extension headers
  boolean extension();
}
