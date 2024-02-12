/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import { nameValidator } from "../../validators"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class UpdateCommand extends BaseCommand {
  static readonly description = "Updates an existing Domain"

  static readonly examples = [
    `<%= config.bin %> <%= command.id %>
Updating Domain Local... 80181ca6-d4aa-4575-9375-8f72b07d5555
`
  ]

  static readonly args = [
    {
      name: "ref",
      required: true,
      description: "reference to an existing Domain"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateCommand)
    const { endpoint, insecure, cacert } = flags

    try {
      const api = new SDK.Domains({ endpoint, insecure, cacert })
      const domainFromDB = await api.getDomain(args.ref)

      // TODO: Fix hardcoded pageSize
      const acls = await new SDK.ACL({ endpoint, insecure, cacert }).listACLs({
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
      const numbers = await new SDK.Numbers({
        endpoint,
        insecure,
        cacert
      }).listNumbers({
        pageSize: 25,
        pageToken: ""
      })

      const numberChoices = numbers.items.map((number: CC.INumber) => {
        return {
          name: number.name,
          value: number.ref
        }
      })

      this.log("This utility will help you update an existing Domain.")
      this.log("Press ^C at any time to quit.")
      this.warn("Adding Egress Policies will delete existing ones.")

      if (numberChoices.length === 0) {
        this.warn("Egress rules unavailable due to 0 configured numbers.")
      }

      const group1 = await inquirer.prompt([
        {
          name: "name",
          message: "Friendly Name",
          type: "input",
          default: domainFromDB.name,
          validate: nameValidator
        },
        {
          name: "accessControlListRef",
          message: "IP Access Control List",
          type: "list",
          choices: [{ name: "None", value: undefined }, ...aclChoices],
          default: domainFromDB.accessControlListRef
        },
        {
          name: "addEgressRule",
          message: "Add an Egress Rule?",
          type: "confirm",
          default: false,
          when: aclChoices.length > 0
        }
      ])

      const group2Questions = [
        {
          name: "numberRef",
          message: "Number",
          type: "list",
          choices: [{ name: "None", value: undefined }, ...numberChoices]
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
        CliUx.ux.action.start(`Updating Domain ${group1.name}`)
        const domain = await api.updateDomain({
          ref: domainFromDB.ref,
          ...group1,
          egressPolicies
        })
        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(domain.ref)
      }
    } catch (e) {
      throw new CLIError(e.message)
    }
  }
}
