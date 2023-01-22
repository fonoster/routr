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
import { CommonTypes as CT, CommonConnect as CC } from "@routr/common"
import { nameValidator, usernameValidator } from "../../validators"
import FuzzySearch from "fuzzy-search"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"
import inquirerPrompt from "inquirer-autocomplete-prompt"

inquirer.registerPrompt("autocomplete", inquirerPrompt)

export default class CreateAgentCommand extends BaseCommand {
  static description = "Creates a new Agent"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Creating Agent Jhon Doe... b148b4b4-6884-4c06-bb7e-bd098f5fe793
`
  ]

  async run(): Promise<void> {
    const { flags } = await this.parse(CreateAgentCommand)
    const { endpoint, insecure } = flags

    this.log("This utility will help you create a new Agent.")
    this.log("Press ^C at any time to quit.")

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

    const domainsList = domains.items.map((domain: CC.Domain) => {
      return {
        name: domain.domainUri,
        description: domain.name,
        value: domain.ref
      }
    })

    const credentialsList = credentials.items.map(
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
        message: "Friendly Name",
        type: "input",
        validate: nameValidator
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
        validate: usernameValidator
      },
      {
        name: "credentialsRef",
        message: "Credentials Name",
        type: "list",
        choices: [{ name: "None", value: undefined }, ...credentialsList]
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
        default: CT.Privacy.NONE
      },
      {
        name: "enabled",
        message: "Enabled",
        type: "confirm",
        default: true
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

    if (!answers.confirm) {
      this.warn("Aborted")
    } else {
      try {
        CliUx.ux.action.start(`Creating Agent ${answers.name}`)
        const api = new SDK.Agents({ endpoint, insecure })
        const agent = await api.createAgent(answers)

        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(agent.ref)
      } catch (e) {
        CliUx.ux.action.stop()
        if (e.code === grpc.status.ALREADY_EXISTS) {
          throw new CLIError("This Agent already exist")
        } else {
          throw new CLIError(e.message)
        }
      }
    }
  }
}
