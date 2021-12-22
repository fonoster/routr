/*
 * Copyright (C) 2021 by Fonoster Inc (https://fonoster.com)
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

export default function listener(processMessage: Function) {
  return new SipListener({
    processRequest: event => {

    // start sip listener based on configuration
    // point sip listener to processMessage
    //    1. Check if message is acceptable based on spec.methods
    //    2. ID message type (Request/Response)
    //    3. Convert Java Object into Protobuf
    //    4. Send over the wire

      processMessage(event)
    }
  }
}