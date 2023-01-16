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
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class CreateNumberCommand extends BaseCommand {
  static description = "Creates a new Number"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Creating Credentials JDoe Access... b148b4b4-6884-4c06-bb7e-bd098f5fe793
`
  ]

  async run(): Promise<void> {
    const { flags } = await this.parse(CreateNumberCommand)
    const { endpoint, insecure } = flags

    this.log("This utility will help you create a new set of Credentials.")
    this.log("Press ^C at any time to quit.")

    const answers = await inquirer.prompt([
      {
        name: "name",
        message: "Name",
        type: "input"
      },
      {
        name: "telUrl",
        message: "Tel URL",
        type: "input"
      },
      {
        name: "aorLink",
        message: "AOR Link",
        type: "input"
      },
      {
        name: "city",
        message: "City",
        type: "input"
      },
      {
        name: "country",
        message: "Country",
        type: "input"
      },
      {
        // TODO: This should have a searchable list of countries
        name: "countryIsoCode",
        message: "Country ISO Code",
        type: "input"
      },
      {
        name: "sessionAffinityHeader",
        message: "Session Affinity Header (e.g. X-Room-Id)",
        type: "input"
      },
      {
        name: "extraHeaders",
        message: "Extra Headers (e.g. X-Room-Id: abc-2s3-xyz)",
        type: "input"
      },
      {
        name: "confirm",
        message: "Ready?",
        type: "confirm"
      }
    ])

    // Re-write extraHeaders
    if (answers.extraHeaders) {
      const extraHeaders = answers.extraHeaders
        .split(",")
        .map((header: string) => {
          const [name, value] = header.split(":")
          return { name, value }
        })
      answers.extraHeaders = extraHeaders
    }

    if (!answers.confirm) {
      this.warn("Aborted")
    } else {
      try {
        CliUx.ux.action.start(`Creating Number ${answers.name}`)
        const api = new SDK.Numbers({ endpoint, insecure })
        const number = await api.createNumber(answers)
        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(number.ref)
      } catch (e) {
        CliUx.ux.action.stop()
        if (e.code === grpc.status.ALREADY_EXISTS) {
          throw new CLIError("This Number already exist")
        } else {
          throw new CLIError(e.message)
        }
      }
    }
  }
}
