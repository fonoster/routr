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
import { aclRuleValidator, nameValidator } from "../../validators"
import { stringToAcl } from "../../utils"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class CreateCommand extends BaseCommand {
  static readonly description = "Creates a new ACL"

  static readonly examples = [
    `<%= config.bin %> <%= command.id %>
Creating ACL US Eeast... b148b4b4-6884-4c06-bb7e-bd098f5fe793
`
  ]

  async run(): Promise<void> {
    const { flags } = await this.parse(CreateCommand)
    const { endpoint, insecure, cacert } = flags

    try {
      this.log("This utility will help you create a new ACL")
      this.log("Press ^C at any time to quit.")

      const answers = await inquirer.prompt([
        {
          name: "name",
          message: "Friendly Name",
          type: "input",
          validate: nameValidator
        },
        {
          name: "deny",
          message: "Deny CIDR Networks",
          type: "input",
          default: "0.0.0.0/0",
          validate: aclRuleValidator
        },
        {
          name: "allow",
          message: "Allow CIDR Networks",
          type: "input",
          validate: aclRuleValidator
        },
        {
          name: "confirm",
          message: "Ready?",
          type: "confirm"
        }
      ])

      // Re-assign allow and deny rules as arrays
      answers.allow = stringToAcl(answers.allow)
      answers.deny = stringToAcl(answers.deny)

      if (!answers.confirm) {
        this.warn("Aborted")
      } else {
        CliUx.ux.action.start(`Creating ACL ${answers.name}`)
        const api = new SDK.Acls({ endpoint, insecure, cacert })
        const acl = await api.createAcl(answers)

        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(acl.ref)
      }
    } catch (e) {
      if (e.code === grpc.status.ALREADY_EXISTS) {
        throw new CLIError("This ACL already exist")
      } else {
        throw new CLIError(e.message)
      }
    }
  }
}
