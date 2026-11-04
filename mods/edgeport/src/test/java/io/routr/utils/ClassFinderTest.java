/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr.
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
package io.routr.utils;

import gov.nist.javax.sip.header.CallID;
import gov.nist.javax.sip.header.From;
import gov.nist.javax.sip.header.Via;
import io.routr.headers.CallIDConverter;
import io.routr.headers.FromConverter;
import io.routr.headers.ViaConverter;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class ClassFinderTest {

  @Test
  public void testTheConvertersAreScannedOnce() {
    // The classpath scan is the expensive part; repeated lookups must reuse its result.
    var first = ClassFinder.findAllConverters();
    var second = ClassFinder.findAllConverters();

    assertSame(first, second);
    assertFalse(first.isEmpty());
  }

  @Test
  public void testEachHeaderStillMapsToItsConverter() {
    assertEquals(CallIDConverter.class, ClassFinder.findConverterByHeaderClass(CallID.class));
    assertEquals(FromConverter.class, ClassFinder.findConverterByHeaderClass(From.class));
    assertEquals(ViaConverter.class, ClassFinder.findConverterByHeaderClass(Via.class));
    // Asking again returns the same answer from the cache
    assertEquals(ViaConverter.class, ClassFinder.findConverterByHeaderClass(Via.class));
  }

  @Test
  public void testAHeaderWithoutAConverterMapsToNull() {
    assertNull(ClassFinder.findConverterByHeaderClass(String.class));
    assertNull(ClassFinder.findConverterByHeaderClass(String.class));
  }
}
