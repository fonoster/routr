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
import * as grpc from "@grpc/grpc-js"
import { CliUx } from "@oclif/core"
import { BaseCommand } from "../../base"
import { CLIError } from "@oclif/core/lib/errors"
import { countries } from "../../countries"
import {
  aorLinkValidator,
  headersValidator,
  nameValidator,
  sessionAffinityHeaderValidator,
  telUrlValidator
} from "../../validators"
import { stringToHeaders } from "../../utils"
import { CommonConnect as CC } from "@routr/common"
import FuzzySearch from "fuzzy-search"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class CreateNumberCommand extends BaseCommand {
  static readonly description = "Creates a new Number"

  static readonly examples = [
    `<%= config.bin %> <%= command.id %>
Creating Number (784) 317-8170... a134487f-a668-4509-9ddd-dcbc98175468
`
  ]

  async run(): Promise<void> {
    const { flags } = await this.parse(CreateNumberCommand)
    const { endpoint, insecure, cacert } = flags

    try {
      const searcher = new FuzzySearch(countries, ["name"], {
        caseSensitive: false
      })

      const trunks = await new SDK.Trunks({
        endpoint,
        insecure,
        cacert
      }).listTrunks({
        pageSize: 25,
        pageToken: ""
      })

      const trunksChoices = trunks.items.map((trunk: CC.Trunk) => {
        return {
          name: trunk.name,
          value: trunk.ref
        }
      })

      this.log("This utility will help you create a new Number.")
      this.log("Press ^C at any time to quit.")

      const answers = await inquirer.prompt([
        {
          name: "name",
          message: "Friendly Name",
          type: "input",
          validate: nameValidator
        },
        {
          name: "telUrl",
          message: "Telephony URL",
          type: "input",
          validate: telUrlValidator
        },
        {
          name: "aorLink",
          message: "AOR Link",
          type: "input",
          validate: aorLinkValidator
        },
        {
          name: "trunkRef",
          message: "Trunk",
          type: "list",
          choices: [{ name: "None", value: undefined }, ...trunksChoices]
        },
        {
          name: "city",
          message: "City",
          type: "input",
          validate: (input: string) => {
            if (input.length === 0) {
              return "the city is required"
            }
            return true
          }
        },
        {
          type: "autocomplete",
          name: "countryISOCode",
          message: "Select a Country",
          source: (_: unknown, input: string) => searcher.search(input)
        },
        {
          name: "sessionAffinityHeader",
          message: "Session Affinity Header",
          type: "input",
          validate: sessionAffinityHeaderValidator
        },
        {
          name: "extraHeaders",
          message: "Extra Headers",
          type: "input",
          validate: headersValidator
        },
        {
          name: "confirm",
          message: "Ready?",
          type: "confirm"
        }
      ])

      // Re-write extraHeaders
      answers.extraHeaders = stringToHeaders(answers.extraHeaders)

      answers.country = countries.find(
        (country) => country.value === answers.countryISOCode
      ).name

      if (!answers.confirm) {
        this.warn("Aborted")
      } else {
        CliUx.ux.action.start(`Creating Number ${answers.name}`)
        const api = new SDK.Numbers({ endpoint, insecure, cacert })
        const number = await api.createNumber(answers)
        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(number.ref)
      }
    } catch (e) {
      if (e.code === grpc.status.ALREADY_EXISTS) {
        throw new CLIError("This Number already exist")
      } else {
        throw new CLIError(e.message)
      }
    }
  }
}
