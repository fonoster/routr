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
import { CommonTypes as CT, CommonConnect as CC } from "@routr/common"
import { maxContactsValidator, nameValidator } from "../../validators"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class UpdateCommand extends BaseCommand {
  static readonly description = "Updates an existing Agent"

  static readonly examples = [
    `<%= config.bin %> <%= command.id %>
Updating Agent John Doe... 80181ca6-d4aa-4575-9375-8f72b07d5555
`
  ]

  static readonly args = [
    {
      name: "ref",
      required: true,
      description: "reference to an existing Agent"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateCommand)
    const { endpoint, insecure, cacert } = flags

    try {
      const api = new SDK.Agents({ endpoint, insecure, cacert })
      const agentFromDB = await api.getAgent(args.ref)

      // TODO: Fix hardcoded pageSize
      const domains = await new SDK.Domains({
        endpoint,
        insecure,
        cacert
      }).listDomains({
        pageSize: 25,
        pageToken: ""
      })

      // TODO: Fix hardcoded pageSize
      const credentials = await new SDK.Credentials({
        endpoint,
        insecure,
        cacert
      }).listCredentials({
        pageSize: 25,
        pageToken: ""
      })

      const domainsList = domains.items?.map((domain: CC.Domain) => {
        return { name: domain.domainUri, value: domain.ref }
      })

      const credentialsList = credentials.items?.map(
        (credential: CC.Credentials) => {
          return { name: credential.name, value: credential.ref }
        }
      )

      this.log("This utility will help you update an existing Agent.")
      this.log("Press ^C at any time to quit.")

      const answers = await inquirer.prompt([
        {
          name: "name",
          message: "Friendly Name",
          type: "input",
          default: agentFromDB.name,
          validate: nameValidator
        },
        {
          name: "domainRef",
          message: "Select a Domain",
          choices: [{ name: "None", value: undefined }, ...domainsList],
          type: "list"
        },
        {
          name: "credentialsRef",
          message: "Credentials Name",
          type: "list",
          choices: [{ name: "None", value: undefined }, ...credentialsList],
          default: agentFromDB.credentialsRef
        },
        {
          name: "maxContacts",
          message: "Max Contacts",
          type: "input",
          default:
            agentFromDB.maxContacts === -1 ? "" : agentFromDB.maxContacts,
          validate: maxContactsValidator
        },
        {
          name: "privacy",
          message: "Privacy",
          type: "list",
          choices: [
            {
              name: "None",
              value: CT.Privacy.NONE
            },
            {
              name: "Private",
              value: CT.Privacy.PRIVATE
            }
          ],
          default: agentFromDB.privacy
        },
        {
          name: "enabled",
          message: "Enabled?",
          type: "confirm",
          default: agentFromDB.enabled
        },
        {
          name: "confirm",
          message: "Ready?",
          type: "confirm"
        }
      ])

      // Re-write privacy to enum
      answers.privacy =
        CT.Privacy[answers.privacy.toUpperCase() as keyof typeof CT.Privacy]

      answers.ref = args.ref

      answers.maxContacts = answers.maxContacts
        ? parseInt(answers.maxContacts)
        : -1

      if (!answers.confirm) {
        this.warn("Aborted")
      } else {
        CliUx.ux.action.start(`Updating Agent ${answers.name}`)
        const agent = await api.updateAgent(answers)
        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(agent.ref)
      }
    } catch (e) {
      throw new CLIError(e.message)
    }
  }
}
