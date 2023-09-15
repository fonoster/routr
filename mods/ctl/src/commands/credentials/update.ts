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
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"
import { nameValidator, usernameValidator } from "../../validators"

export default class UpdateCommand extends BaseCommand {
  static description = "Updates an existing set of Credentials"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Updating Credentials JDoe Credentials... 80181ca6-d4aa-4575-9375-8f72b07d5555
`
  ]

  static args = [
    {
      name: "ref",
      required: true,
      description: "reference to an existing set of Credentials"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateCommand)
    const { endpoint, insecure, cacert } = flags

    try {
      const api = new SDK.Credentials({ endpoint, insecure, cacert })
      const credentialsFromDB = await api.getCredentials(args.ref)

      this.log(
        "This utility will help you update an existing set of Credentials."
      )
      this.log("Press ^C at any time to quit.")

      const answers = await inquirer.prompt([
        {
          name: "name",
          message: "Friendly Name",
          type: "input",
          default: credentialsFromDB.name,
          validate: nameValidator
        },
        {
          name: "username",
          message: "Username",
          type: "input",
          default: credentialsFromDB.username,
          validate: usernameValidator
        },
        {
          name: "password",
          message: "Password",
          type: "password"
        },
        {
          name: "confirm",
          message: "Ready?",
          type: "confirm"
        }
      ])

      answers.ref = args.ref

      if (!answers.confirm) {
        this.warn("Aborted")
      } else {
        CliUx.ux.action.start(`Updating Credentials for ${answers.name}`)
        const acl = await api.updateCredentials(answers)
        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(acl.ref)
      }
    } catch (e) {
      throw new CLIError(e.message)
    }
  }
}
