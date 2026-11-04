package io.routr.utils;

import io.routr.headers.Converter;
import io.routr.headers.ProtoMapping;
import org.reflections.Reflections;
import org.reflections.scanners.SubTypesScanner;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

public class ClassFinder {
  // The converters never change at runtime, so the classpath is scanned once. Scanning per
  // header (Reflections reads every class file in io.routr.headers) cost ~2.8 ms of CPU per
  // SIP message and capped an EdgePort at a few hundred messages per second.
  private static volatile List<Class<Converter>> converters;
  private static final Map<Class<?>, Optional<Class<Converter>>> BY_HEADER =
      new ConcurrentHashMap<>();

  public static Set<Class> findAllClassesUsingReflections(String packageName) {
    var reflections = new Reflections(packageName, new SubTypesScanner(false));
    return reflections.getSubTypesOf(Object.class)
        .stream()
        .collect(Collectors.toSet());
  }

  public static List<Class<Converter>> findAllConverters() {
    var cached = converters;
    if (cached != null) {
      return cached;
    }
    synchronized (ClassFinder.class) {
      if (converters == null) {
        converters = Collections.unmodifiableList(scanConverters());
      }
      return converters;
    }
  }

  private static List<Class<Converter>> scanConverters() {
    var classes = findAllClassesUsingReflections("io.routr.headers").iterator();
    var found = new ArrayList();

    while (classes.hasNext()) {
      var converter = classes.next();
      ProtoMapping mapping = (ProtoMapping) converter.getAnnotation(ProtoMapping.class);
      if (mapping != null)
        found.add(converter);
    }
    return found;
  }

  public static Class<Converter> findConverterByHeaderClass(Class<?> clasz) {
    return BY_HEADER.computeIfAbsent(clasz, header -> {
      for (Class<Converter> converter : findAllConverters()) {
        ProtoMapping mapping = converter.getAnnotation(ProtoMapping.class);
        if (mapping.header().equals(header))
          return Optional.of(converter);
      }
      return Optional.empty();
    }).orElse(null);
  }
}
