/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
 *
 * Licensed under the MIT License (the "License")
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
import { LocationConfig } from "./types"
import { 
  createService,
} from "@routr/common"
import { getServiceInfo } from "./utils"
import Locator from "./locator"
import MemoryStore from "./memory_store"

export default function LocationService(config: LocationConfig) {
  const { bindAddr } = config
  createService(getServiceInfo(bindAddr, new Locator(new MemoryStore())))
}
