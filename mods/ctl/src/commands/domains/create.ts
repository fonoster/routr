/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
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
/* eslint-disable require-jsdoc */
import * as grpc from "@grpc/grpc-js"
import { CliUx } from "@oclif/core"
import { BaseCommand } from "../../base"
import { CLIError } from "@oclif/core/lib/errors"
import { CommonConnect as CC } from "@routr/common"
import { domainUriValidator, nameValidator } from "../../validators"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class CreateCommand extends BaseCommand {
  static description = "Creates a new set Domain"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Creating Domain Local Domain... b148b4b4-6884-4c06-bb7e-bd098f5fe793
`
  ]

  async run(): Promise<void> {
    const { flags } = await this.parse(CreateCommand)
    const { endpoint, insecure } = flags

    this.log("This utility will help you create a new Domain.")
    this.log("Press ^C at any time to quit.")

    // TODO: Fix hardcoded pageSize
    const acls = await new SDK.ACL({ endpoint, insecure }).listACLs({
      pageSize: 25,
      pageToken: ""
    })

    const aclChoices = acls.items.map((acl: CC.AccessControlList) => {
      return {
        name: acl.name,
        value: acl.ref
      }
    })

    // TODO: Fix hardcoded pageSize
    const numbers = await new SDK.Numbers({ endpoint, insecure }).listNumbers({
      pageSize: 25,
      pageToken: ""
    })

    const numberChoices = numbers.items.map((number: CC.INumber) => {
      return {
        name: number.name,
        value: number.ref
      }
    })

    const group1 = await inquirer.prompt([
      {
        name: "name",
        message: "Friendly Name",
        type: "input",
        validate: nameValidator
      },
      {
        name: "domainUri",
        message: "SIP URI",
        type: "input",
        validate: domainUriValidator
      },
      {
        name: "accessControlListRef",
        message: "IP Access Control List",
        type: "list",
        choices: [{ name: "None", value: undefined }, ...aclChoices]
      },
      {
        name: "addEgressRule",
        message: "Add an Egress Rule?",
        type: "confirm",
        default: false,
        when: numberChoices.length > 0
      }
    ])

    const group2Questions = [
      {
        name: "numberRef",
        message: "Number",
        type: "list",
        choices: [{ name: "None", value: undefined }, ...numberChoices],
        when: numberChoices.length > 0
      },
      {
        name: "rule",
        message: "Rule",
        type: "input",
        default: ".*",
        when: (answers: { numberRef: string }) => answers.numberRef
      },
      {
        name: "addEgressRule",
        message: "Add another Egress Rule?",
        type: "confirm",
        default: false,
        when: (answers: { numberRef: string }) => answers.numberRef
      }
    ]

    let addEgressRule = group1.addEgressRule
    const egressPolicies: CC.EgressPolicy[] = []

    // eslint-disable-next-line no-loops/no-loops
    while (addEgressRule) {
      const group2 = await inquirer.prompt(group2Questions)
      if (group2.numberRef) {
        egressPolicies.push({
          numberRef: group2.numberRef,
          rule: group2.rule
        })
      }

      addEgressRule = group2.addEgressRule
    }

    const group3 = await inquirer.prompt([
      {
        name: "confirm",
        message: "Ready?",
        type: "confirm"
      }
    ])

    if (!group3.confirm) {
      this.warn("Aborted")
    } else {
      try {
        CliUx.ux.action.start(`Creating Domain ${group1.name}`)
        const api = new SDK.Domains({ endpoint, insecure })
        const domains = await api.createDomain({
          ...group1,
          egressPolicies
        })
        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(domains.ref)
      } catch (e) {
        CliUx.ux.action.stop()
        if (e.code === grpc.status.ALREADY_EXISTS) {
          throw new CLIError("This Domain already exist")
        } else {
          throw new CLIError(e.message)
        }
      }
    }
  }
}
