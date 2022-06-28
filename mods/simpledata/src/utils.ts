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
import logger from "@fonoster/logger"
import {UnimplementedError} from "./errors"
import {Resource} from "./types"
import Ajv from "ajv"

export function createValidators(path: string) {
  const validators: Map<string, any> = new Map()
  const files = require("fs").readdirSync(path)
  files.forEach((file: File) => {
    const schema = require(`${path}/${file}`)
    const ajv = new Ajv()
    const validator = ajv.compile(schema)
    validators.set(schema.properties.kind.enum[0].toLowerCase(), validator)
  })
  return validators
}

export default function loadResources(
  validatorsPath: string,
  resourcesPath: string
): Resource[] {
  const validators = createValidators(validatorsPath)
  const all: Resource[] = []
  const files = require("fs").readdirSync(resourcesPath)
  files.forEach((file: File) => {
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
          "found a bad resource: " + JSON.stringify(validate.errors[0].message)
        )
        process.exit(1)
      }
    })
  })
  logger.info("loaded data resources", {total: all.length})
  return all
}

export function nyi(call: any, callback: any) {
  callback(new UnimplementedError())
}
