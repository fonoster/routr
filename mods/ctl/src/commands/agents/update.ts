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
import { CommonTypes as CT, CommonConnect as CC } from "@routr/common"
import FuzzySearch from "fuzzy-search"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class UpdateCommand extends BaseCommand {
  static description = "Updates an existing Agent"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Updating Agent John Doe... 80181ca6-d4aa-4575-9375-8f72b07d5555
`
  ]

  static args = [
    {
      name: "ref",
      required: true,
      description: "optional reference to an Agent"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateCommand)
    const { endpoint, insecure } = flags
    const api = new SDK.Agents({ endpoint, insecure })

    this.log("This utility will help you update an existing Agent.")
    this.log("Press ^C at any time to quit.")

    const agentFromDB = await api.getAgent(args.ref)

    // TODO: Fix hardcoded pageSize
    const domains = await new SDK.Domains({ endpoint, insecure }).listDomains({
      pageSize: 25,
      pageToken: ""
    })

    // TODO: Fix hardcoded pageSize
    const credentials = await new SDK.Credentials({
      endpoint,
      insecure
    }).listCredentials({
      pageSize: 25,
      pageToken: ""
    })

    if (domains.items.length === 0 || credentials.items.length === 0) {
      this.warn("Domains and Credentials are required for correct operation.")
    }

    const domainsList = domains.items?.map((domain: CC.Domain) => {
      return { name: domain.domainUri, value: domain.ref }
    })

    const credentialsList = credentials.items?.map(
      (credential: CC.Credentials) => {
        return { name: credential.name, value: credential.ref }
      }
    )

    const searcher = new FuzzySearch(
      domainsList,
      ["name", "value", "description"],
      {
        caseSensitive: false
      }
    )

    const answers = await inquirer.prompt([
      {
        name: "name",
        message: "Name",
        type: "input",
        default: agentFromDB.name
      },
      {
        type: "autocomplete",
        name: "domainRef",
        message: "Select a Domain",
        source: (_: unknown, input: string) => searcher.search(input),
        when: () => domains.items.length > 0
      },
      {
        name: "username",
        message: "Username",
        type: "input",
        default: agentFromDB.username
      },
      {
        name: "credentialsRef",
        message: "Credentials",
        type: "list",
        choices: credentialsList,
        default: agentFromDB.credentialsRef,
        when: () => credentials.items.length > 0
      },
      {
        name: "privacy",
        message: "Privacy",
        type: "list",
        choices: [
          {
            name: "Private",
            value: CT.Privacy.PRIVATE
          },
          {
            name: "None",
            value: CT.Privacy.NONE
          }
        ],
        default: agentFromDB.privacy
      },
      {
        name: "enabled",
        message: "Enabled",
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

    if (!answers.confirm) {
      this.warn("Aborted")
    } else {
      try {
        CliUx.ux.action.start(`Updating Agent ${answers.name}`)
        const agent = await api.updateAgent(answers)
        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(agent.ref)
      } catch (e) {
        CliUx.ux.action.stop()
        throw new CLIError(e.message)
      }
    }
  }
}
