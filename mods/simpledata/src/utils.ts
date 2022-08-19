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
import {UnimplementedError} from "./errors"
import {Resource} from "./types"
import Ajv from "ajv"
import {CommonTypes as CT} from "@routr/common"
import {getLogger} from "@fonoster/logger"

const logger = getLogger({service: "simpledata", filePath: __filename})

/**
 * Creates a list of validators from the given schemas.
 *
 * @param {string} path - the path to the resource
 * @return {Validator} - a list of validators from the path
 */
export function createValidators(path: string) {
  const validators: Map<string, (resource: Resource) => unknown> = new Map()
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const files = require("fs").readdirSync(path)
  files.forEach((file: File) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const schema = require(`${path}/${file}`)
    const ajv = new Ajv()
    const validator = ajv.compile(schema)
    validators.set(schema.properties.kind.enum[0].toLowerCase(), validator)
  })
  return validators
}

/**
 * Loads a list of resources from a file.
 *
 * @param {string} validatorsPath - the path to the validators
 * @param {string} resourcesPath - the path to the resources
 * @return {Resource[]} the loaded resources
 */
export default function loadResources(
  validatorsPath: string,
  resourcesPath: string
): Resource[] {
  const validators = createValidators(validatorsPath)
  const all: Resource[] = []
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const files = require("fs").readdirSync(resourcesPath)
  files.forEach((file: File) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const resources = require(`${resourcesPath}/${file}`)
    resources.forEach((resource: Resource) => {
      // Check if is valid using jsonschema
      const validate = validators.get(resource.kind.toLocaleLowerCase())
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
  logger.info("loaded data resources", {total: all.length})
  return all
}

/**
 * Returns UnimplementedError via callback.
 *
 * @param {GrpcCall} call - the grpc request
 * @param {GrpcCallback} callback - the grpc callback
 */
export function nyi(call: CT.GrpcCall, callback: CT.GrpcCallback) {
  callback(new UnimplementedError())
}
