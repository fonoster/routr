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
import {
  aorLinkValidator,
  headersValidator,
  nameValidator,
  sessionAffinityHeaderValidator
} from "../../validators"
import { stringToHeaders } from "../../utils"
import { CommonConnect as CC } from "@routr/common"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class UpdateCommand extends BaseCommand {
  static description = "Updates an existing set of Credentials"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Updating Number (785) 317-8070... 80181ca6-d4aa-4575-9375-8f72b07d5555
`
  ]

  static args = [
    {
      name: "ref",
      required: true,
      description: "reference to an existing Number"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateCommand)
    const { endpoint, insecure } = flags
    const api = new SDK.Numbers({ endpoint, insecure })

    this.log("This utility will help you update an existing Number.")
    this.log("Press ^C at any time to quit.")

    const numberFromDB = await api.getNumber(args.ref)

    const trunks = await new SDK.Trunks({ endpoint, insecure }).listTrunks({
      pageSize: 25,
      pageToken: ""
    })

    const trunksChoices = trunks.items.map((trunk: CC.Trunk) => {
      return {
        name: trunk.name,
        value: trunk.ref
      }
    })

    const answers = await inquirer.prompt([
      {
        name: "name",
        message: "Friendly Name",
        type: "input",
        default: numberFromDB.name,
        validate: nameValidator
      },
      {
        name: "aorLink",
        message: "AOR Link",
        type: "input",
        default: numberFromDB.aorLink || undefined,
        validate: aorLinkValidator
      },
      {
        name: "trunkRef",
        message: "Trunk",
        type: "list",
        choices: [{ name: "None", value: undefined }, ...trunksChoices],
        default: numberFromDB.trunkRef
      },
      {
        name: "sessionAffinityHeader",
        message: "Session Affinity Header",
        type: "input",
        default: numberFromDB.sessionAffinityHeader || undefined,
        validate: sessionAffinityHeaderValidator
      },
      {
        name: "extraHeaders",
        message: "Extra Headers",
        type: "input",
        default:
          numberFromDB.extraHeaders
            ?.map((header: { name: string; value: string }) => {
              return `${header.name}:${header.value}`
            })
            .join(",") || undefined,
        validate: headersValidator
      },
      {
        name: "confirm",
        message: "Ready?",
        type: "confirm"
      }
    ])

    answers.ref = args.ref

    // Re-write extraHeaders
    answers.extraHeaders = stringToHeaders(answers.extraHeaders)

    if (!answers.confirm) {
      this.warn("Aborted")
    } else {
      try {
        CliUx.ux.action.start(`Updating Number ${answers.name}`)
        const number = await api.updateNumber(answers)
        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(number.ref)
      } catch (e) {
        CliUx.ux.action.stop()
        throw new CLIError(e.message)
      }
    }
  }
}
