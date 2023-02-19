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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Java: any

import { SipStack } from "./types"

const SipFactory = Java.type("javax.sip.SipFactory")
const Properties = Java.type("java.util.Properties")

/**
 * Takes a properties map and returns an instance of the SipStack(Java object).
 *
 * @param {Properties} properties - Properties map
 * @return {SipStack}
 */
export default function createSipStack(
  properties: typeof Properties
): SipStack {
  const sipFactory = SipFactory.getInstance()
  sipFactory.setPathName("gov.nist")
  return sipFactory.createSipStack(properties)
}
