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
declare const System: any

// require("./tracer").init("dispatcher")
import { getConfig } from "./config/get_config"
import { EdgePortConfig } from "./types"
import edgePortService from "./edgeport"

const config = getConfig<EdgePortConfig>(System.getenv("CONFIG_PATH"))

if (config._tag === "Right") {
  // TODO: Remove this once we have a proper config (It should be managed by getConfig)
  config.right.spec.bindAddr = config.right.spec.bindAddr ?? "0.0.0.0"
  edgePortService(config.right)
} else {
  // WARNING: Using @fonoster/logger causes conflict with Webpack.
  // eslint-disable-next-line no-console
  console.log(config.left)
}
