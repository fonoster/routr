/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import { getLogger } from "@fonoster/logger"
import {
  CommonConnect as CC,
  CommonTypes as CT,
  CommonErrors as CE,
  ConnectSchemas as CS,
  Helper as H
} from "@routr/common"

const logger = getLogger({ service: "simpledata", filePath: __filename })

// Create function to validate reference exists for Agent
const checkReferences = (resources: CC.UserConfig[]) => {
  // Check that reference have not been duplicated
  const references = resources.map((r) => r.ref)
  const duplicates = references.filter(
    (ref, index) => references.indexOf(ref) !== index
  )

  if (duplicates.length > 0) {
    logger.error(`found duplicated references: ${duplicates}; exiting`)
    process.exit(1)
  }
}

/**
 * Loads a list of resources from a file.
 *
 * @param {string} resourcesPath - the path to the resources
 * @param {string} kind - the kind of resource to load
 * @return {Resource[]} the loaded resources
 */
export default function loadResources(
  resourcesPath: string,
  kind?: CC.Kind
): CC.RoutrResourceUnion[] {
  const all: CC.UserConfig[] = []
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const files = require("fs").readdirSync(resourcesPath)

  files.forEach((file: File) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const resources = H.readConfigFile(`${resourcesPath}/${file}`)

    resources.forEach((resource: CC.UserConfig) => {
      resource.kind = resource.kind.toLowerCase() as any

      // Assert the reference has no spaces
      if (resource.ref.includes(" ")) {
        logger.error(
          `resource type ${resource.kind} has spaces in the reference: "${resource.ref}"; exiting`
        )
        process.exit(1)
      }

      // Check if is valid using jsonschema
      const validate = CS.schemaValidators.get(resource.kind.toLowerCase())

      if (!validate) {
        logger.error(`unable to find validator for ${resource.kind}; exiting`)
        process.exit(1)
      }

      if (validate(resource)) {
        all.push(resource)
      } else {
        logger.error(
          "found a bad resource: " +
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            JSON.stringify((validate as any).errors[0].message)
        )
        process.exit(1)
      }
    })
  })

  // Referencial check
  checkReferences(all)

  // Convert to Resource
  const allMapToResources: CC.RoutrResourceUnion[] = all
    .filter((r) => !kind || r.kind.toLowerCase() == kind.toLowerCase())
    .map((r) => CC.getConverter(r.kind)(r, all))

  logger.verbose("loaded data resources", { total: allMapToResources.length })
  return allMapToResources
}

/**
 * Returns UnimplementedError via callback.
 *
 * @param {GrpcCall} call - the grpc request
 * @param {GrpcCallback} callback - the grpc callback
 */
export function nyi(call: CT.GrpcCall, callback: CT.GrpcCallback) {
  callback(new CE.UnimplementedError())
}
