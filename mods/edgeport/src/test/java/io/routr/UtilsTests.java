package io.routr;

import static org.junit.jupiter.api.Assertions.assertEquals;
import java.lang.reflect.InvocationTargetException;
import java.text.ParseException;
import java.util.Set;
import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.header.HeaderFactory;
import org.junit.jupiter.api.Test;
import gov.nist.javax.sip.header.CallID;
import io.routr.headers.Converter;
import io.routr.headers.CallIDConverter;
import io.routr.utils.ClassFinder;

public class UtilsTests {

  @Test
  public void testFindClassWithReflection() {
    Set<?> set = ClassFinder.findAllClassesUsingReflections("io.routr.headers");
    assertEquals(18, set.size());
  }

  @Test
  public void checkForCorrectInstance() throws InstantiationException, IllegalAccessException, IllegalArgumentException,
      InvocationTargetException, NoSuchMethodException, SecurityException, ParseException, PeerUnavailableException {
    HeaderFactory factory = SipFactory.getInstance().createHeaderFactory();
    CallID header = (CallID) factory.createCallIdHeader("call001");
    Class<Converter> converterClass = ClassFinder.findConverterByHeaderClass(CallID.class);
    CallIDConverter converter = (CallIDConverter) converterClass.getDeclaredConstructor().newInstance();
    assertEquals("call001", converter.fromHeader(header).getCallId());
  }
}
