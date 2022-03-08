package io.routr.utils;

import org.reflections.scanners.SubTypesScanner;

import io.routr.headers.Converter;
import io.routr.headers.ProtoMapping;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import javax.sip.header.Header;

import org.reflections.Reflections;

public class ClassFinder {
  static public Set<Class> findAllClassesUsingReflectionsLibrary(String packageName) {
    var reflections = new Reflections(packageName, new SubTypesScanner(false));
    return reflections.getSubTypesOf(Object.class)
        .stream()
        .collect(Collectors.toSet());
  }

  static public List<Class<Converter>>  findAllConverters() {
    var classes = findAllClassesUsingReflectionsLibrary("io.routr.headers").iterator();
    var converters = new ArrayList();

    while (classes.hasNext()) {
      var converter = classes.next();
      ProtoMapping mapping = (ProtoMapping) converter.getAnnotation(ProtoMapping.class);
      if (mapping != null)
        converters.add(converter);
    }
    return converters;
  }

  static public Class<Converter> findConverterByHeaderClass(Class<?> clasz) {
    var converters = findAllConverters().iterator();
    while (converters.hasNext()) {
      var converter = converters.next();
      ProtoMapping mapping = (ProtoMapping) converter.getAnnotation(ProtoMapping.class);
      if (mapping.header().equals(clasz))
        return converter;
    }
    return null;
  }
}
