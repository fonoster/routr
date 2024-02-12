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
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"
import { nameValidator, usernameValidator } from "../../validators"

export default class CreateCommand extends BaseCommand {
  static readonly description = "Creates a new set of Credentials"

  static readonly examples = [
    `<%= config.bin %> <%= command.id %>
Creating Credentials JDoe Access... b148b4b4-6884-4c06-bb7e-bd098f5fe793
`
  ]

  async run(): Promise<void> {
    const { flags } = await this.parse(CreateCommand)
    const { endpoint, insecure, cacert } = flags

    this.log("This utility will help you create a new set of Credentials.")
    this.log("Press ^C at any time to quit.")

    const answers = await inquirer.prompt([
      {
        name: "name",
        message: "Friendly Name",
        type: "input",
        validate: nameValidator
      },
      {
        name: "username",
        message: "Username",
        type: "input",
        validate: usernameValidator
      },
      {
        name: "password",
        message: "Password",
        type: "password",
        validate: (value: string) => {
          if (!value) {
            return "the password is required"
          }

          return true
        }
      },
      {
        name: "confirm",
        message: "Ready?",
        type: "confirm"
      }
    ])

    if (!answers.confirm) {
      this.warn("Aborted")
    } else {
      try {
        CliUx.ux.action.start(`Creating Credentials ${answers.name}`)
        const api = new SDK.Credentials({ endpoint, insecure, cacert })
        const credentials = await api.createCredentials(answers)

        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(credentials.ref)
      } catch (e) {
        if (e.code === grpc.status.ALREADY_EXISTS) {
          throw new CLIError("This Credentials already exist")
        } else {
          throw new CLIError(e.message)
        }
      }
    }
  }
}
