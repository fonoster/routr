/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import { getLogger } from "@fonoster/logger"
import { CommonConnect as CC } from "@routr/common"
import { getLoader } from "./loader"

const logger = getLogger({ service: "simpledata", filePath: __filename })

export const findByRef = (ref: string, list: CC.UserConfig[]) => {
  const resource = list.find((r) => r.ref === ref)
  if (ref != null && resource == null) {
    logger.error(
      `the resource with ref ${ref} does not exist in the configuration file; exiting`
    )
    process.exit(1)
  }

  return resource ? getLoader(resource.kind)(resource, list) : null
}
