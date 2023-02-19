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
package io.routr;

import gov.nist.javax.sip.header.CallID;
import io.routr.headers.CallIDConverter;
import io.routr.headers.Converter;
import io.routr.utils.ClassFinder;
import org.junit.jupiter.api.Test;

import javax.sip.PeerUnavailableException;
import javax.sip.SipFactory;
import javax.sip.header.HeaderFactory;
import java.lang.reflect.InvocationTargetException;
import java.text.ParseException;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
    assert converterClass != null;
    CallIDConverter converter = (CallIDConverter) converterClass.getDeclaredConstructor().newInstance();
    assertEquals("call001", converter.fromHeader(header).getCallId());
  }
}
