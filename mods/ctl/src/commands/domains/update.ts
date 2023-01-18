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
import { CliUx } from "@oclif/core"
import { BaseCommand } from "../../base"
import { CLIError } from "@oclif/core/lib/errors"
import { CommonConnect as CC } from "@routr/common"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class UpdateCommand extends BaseCommand {
  static description = "Updates an existing Domain"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Updating Domain Local... 80181ca6-d4aa-4575-9375-8f72b07d5555
`
  ]

  static args = [
    { name: "ref", required: true, description: "reference to a Domain" }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateCommand)
    const { endpoint, insecure } = flags
    const api = new SDK.Domains({ endpoint, insecure })

    this.log("This utility will help you update an existing Domain.")
    this.log("Press ^C at any time to quit.")

    const domainFromDB = await api.getDomain(args.ref)

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

    const answers = await inquirer.prompt([
      {
        name: "name",
        message: "Name",
        type: "input",
        default: domainFromDB.name
      },
      {
        name: "accessControlListRef",
        message: "ACL",
        type: "list",
        choices: aclChoices,
        when: aclChoices.length > 0,
        default: domainFromDB.accessControlListRef
      },
      {
        type: "loop",
        name: "egressPolicies",
        message: "Add an Egress Policy?",
        questions: [
          {
            name: "rule",
            type: "input",
            message: "Egress Rule",
            default: ".*"
          },
          {
            name: "numberRef",
            message: "Number",
            type: "list",
            choices: [...numberChoices]
          }
        ],
        when: numberChoices.length > 0
      }
      /* {
        name: "confirm",
        message: "Ready?",
        type: "confirm"
      }*/
    ])

    answers.ref = args.ref

    // if (!answers.confirm) {
    //   this.warn("Aborted")
    // } else {
    try {
      CliUx.ux.action.start(`Updating Domain ${answers.name}`)
      const domain = await api.updateDomain(answers)
      await CliUx.ux.wait(1000)
      CliUx.ux.action.stop(domain.ref)
    } catch (e) {
      CliUx.ux.action.stop()
      throw new CLIError(e.message)
    }
    // }
  }
}
