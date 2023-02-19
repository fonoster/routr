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
import { ListeningPoint, SipProvider, SipStack } from "./types"

/**
 * Creates a new SIP provider object.
 *
 * @param {SipStack} sipStack - SIP stack to use
 * @param {Array<ListeningPoint>} listeningPoints - Listening points to use
 * @return {SipProvider}
 */
export default function createSipProvider(
  sipStack: SipStack,
  listeningPoints: Array<ListeningPoint>
): SipProvider {
  const sipProvider = sipStack.createSipProvider(listeningPoints[0])
  listeningPoints
    .filter((_, index: number) => index > 0)
    .forEach((lp1) => {
      sipProvider.addListeningPoint(lp1)
    })
  return sipProvider
}
