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

import org.junit.jupiter.api.Test;

import javax.sip.message.MessageFactory;
import javax.sip.message.Response;
import javax.sip.SipFactory;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class ResponseHelperTest {

  @Test
  public void hasCodesIdentifies183SessionProgress() throws Exception {
    MessageFactory messageFactory = SipFactory.getInstance().createMessageFactory();
    Response sessionProgress = messageFactory.createResponse(
        "SIP/2.0 183 Session Progress\r\n\r\n");
    Response ok = messageFactory.createResponse(
        "SIP/2.0 200 OK\r\n\r\n");

    assertTrue(ResponseHelper.hasCodes(sessionProgress, Response.SESSION_PROGRESS));
    assertFalse(ResponseHelper.hasCodes(ok, Response.SESSION_PROGRESS));
  }
}
