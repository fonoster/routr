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
import { BadRequest, UnimplementedError } from "./errors"
import Ajv from "ajv"
import { CommonTypes as CT } from "@routr/common"
import { getLogger } from "@fonoster/logger"
import { CommonConnect as CC } from "@routr/common"
import * as protobufUtil from "pb-util"
const jsonFromStruct = protobufUtil.struct.decode

const logger = getLogger({ service: "simpledata", filePath: __filename })

const findCriteriaMap: {
  [key: string]: (parameters: Record<string, string>) => string
} = {}

findCriteriaMap[CC.FindCriteria.FIND_AGENT_BY_USERNAME] = (
  parameters: Record<string, string>
) => `$..[?(@.spec.username=='${parameters.username}')]`

findCriteriaMap[CC.FindCriteria.FIND_PEER_BY_USERNAME] = (
  parameters: Record<string, string>
) => `$..[?(@.spec.username=='${parameters.username}')]`

findCriteriaMap[CC.FindCriteria.FIND_CREDENTIAL_BY_REFERENCE] = (
  parameters: Record<string, string>
) => `$..[?(@.ref=='${parameters.ref}')]`

findCriteriaMap[CC.FindCriteria.FIND_DOMAIN_BY_DOMAINURI] = (
  parameters: Record<string, string>
) => `$..[?(@.spec.context.domainUri=='${parameters.domainUri}')]`

findCriteriaMap[CC.FindCriteria.FIND_NUMBER_BY_TELURL] = (
  parameters: Record<string, string>
) => `$..[?(@.spec.location.telUrl=="${parameters.telUrl}")]`

findCriteriaMap[CC.FindCriteria.FIND_TRUNKS_WITH_SEND_REGISTER] = () =>
  "$..[?(@.spec.outbound.sendRegister==true)]"

findCriteriaMap[CC.FindCriteria.FIND_TRUNK_BY_REQUEST_URI] = (
  parameters: Record<string, string>
) => `$..[?(@.spec.inbound.uri=="${parameters.requestUri}")]`

/**
 * Creates a list of validators from the given schemas.
 *
 * @param {string} path - the path to the resource
 * @return {Validator} - a list of validators from the path
 */
export function createValidators(path: string) {
  const validators: Map<string, (resource: CC.Resource) => unknown> = new Map()
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

// Create function to validate reference exists for Agent
const checkReferences = (resources: CC.Resource[]) => {
  const referenceExist = (ref: string) =>
    resources.filter((r) => r.ref === ref)[0]

  // For every resource, check that the reference exists using a switch
  resources.forEach((resource: CC.Resource) => {
    switch (resource.kind.toLocaleLowerCase()) {
      case CC.Kind.AGENT:
        if (resource.spec.credentialsRef) {
          if (!referenceExist(resource.spec.credentialsRef)) {
            logger.error(
              `agent ${resource.ref} has a credential reference that does not exist: ${resource.spec.credentialsRef}; exiting`
            )
            process.exit(1)
          }
        }
        if (resource.spec.domainRef) {
          if (!referenceExist(resource.spec.domainRef)) {
            logger.error(
              `agent ${resource.ref} has a domain reference that does not exist: ${resource.spec.domainRef}; exiting`
            )
            process.exit(1)
          }
        }
        break
      case CC.Kind.PEER:
        if (resource.spec.credentialsRef) {
          if (!referenceExist(resource.spec.credentialsRef)) {
            logger.error(
              `peer ${resource.ref} has a credential reference that does not exist: ${resource.spec.credentialsRef}; exiting`
            )
            process.exit(1)
          }
        }
        break
      case CC.Kind.TRUNK:
        if (resource.spec.inbound.credentialsRef) {
          if (!referenceExist(resource.spec.inbound.credentialsRef)) {
            logger.error(
              `trunk ${resource.ref} has a credential reference that does not exist: ${resource.spec.inbound.credentialsRef}; exiting`
            )
            process.exit(1)
          }
        }
        if (resource.spec.inbound.accessControlListRef) {
          if (!referenceExist(resource.spec.inbound.accessControlListRef)) {
            logger.error(
              `trunk ${resource.ref} has an acl reference that does not exist: ${resource.spec.inbound.accessControlListRef}; exiting`
            )
            process.exit(1)
          }
        }
        break
      case CC.Kind.DOMAIN:
        if (resource.spec.accessControlListRef) {
          if (!referenceExist(resource.spec.accessControlListRef)) {
            logger.error(
              `domain ${resource.ref} has an acl reference that does not exist: ${resource.spec.accessControlListRef}; exiting`
            )
            process.exit(1)
          }
        }

        if (resource.spec.context?.egressPolicies) {
          resource.spec.context.egressPolicies.forEach(
            (policy: { numberRef: string }) => {
              if (policy.numberRef) {
                if (!referenceExist(policy.numberRef)) {
                  logger.error(
                    `domain ${resource.ref} has a number reference that does not exist: ${policy.numberRef}; exiting`
                  )
                  process.exit(1)
                }
              }
            }
          )
        }
        break
      case CC.Kind.NUMBER:
        if (!referenceExist(resource.spec.trunkRef)) {
          logger.error(
            `number ${resource.ref} has a trunk reference that does not exist: ${resource.spec.trunkRef}; exiting`
          )
          process.exit(1)
        }
        break
    }
  })
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
): CC.Resource[] {
  const validators = createValidators(validatorsPath)
  const all: CC.Resource[] = []
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const files = require("fs").readdirSync(resourcesPath)
  files.forEach((file: File) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const resources = require(`${resourcesPath}/${file}`)

    resources.forEach((resource: CC.Resource) => {
      // Assert the reference has no spaces
      if (resource.ref.includes(" ")) {
        logger.error(
          `resource type ${resource.kind} has spaces in the reference: "${resource.ref}"; exiting`
        )
        process.exit(1)
      }

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

  // Referencial check
  checkReferences(all)

  logger.verbose("loaded data resources", { total: all.length })
  return all
}

// eslint-disable-next-line require-jsdoc
export function createQuery(request: CC.FindParameters):
  | {
      request: CC.FindParameters
      query: string
    }
  | BadRequest {
  const findCriteria = request.criteria as unknown as CC.FindCriteria

  if (!request.criteria || !request.kind || !request.parameters) {
    return new BadRequest(
      "createQuery request is missing 'criteria', 'kind', or 'parameters'"
    )
  }

  if (!findCriteriaMap[findCriteria]) {
    return new BadRequest(`invalid find criteria ${request.criteria}`)
  }

  return {
    query: findCriteriaMap[findCriteria](
      jsonFromStruct(request.parameters) as Record<string, string>
    ),
    request
  }
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
