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
import { CommonTypes as CC } from "@routr/common"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class UpdateCommand extends BaseCommand {
  static description = "Updates an existing set of Credentials"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Updating ACL US East... 80181ca6-d4aa-4575-9375-8f72b07d5555
`
  ]

  static args = [
    { name: "ref", required: true, description: "Credentials reference" }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateCommand)
    const { endpoint, insecure } = flags
    const api = new SDK.Trunks({ endpoint, insecure })

    this.log(
      "This utility will help you update an existing set of Credentials."
    )
    this.log("Press ^C at any time to quit.")

    const trunkFromDB = await api.getTrunk(args.ref)

    // TODO: Add support for pagination
    const acls = await new SDK.ACL({ endpoint, insecure }).listACLs({
      pageSize: 25,
      pageToken: ""
    })

    const aclChoices = acls.items.map((acl) => {
      return {
        name: acl.name,
        value: acl.ref
      }
    })

    const credentials = await new SDK.Credentials({
      endpoint,
      insecure
    }).listCredentials({
      pageSize: 25,
      pageToken: ""
    })

    const credentialsChoice = credentials.items.map((acl) => {
      return {
        name: acl.name,
        value: acl.ref
      }
    })

    const answers = await inquirer.prompt([
      {
        name: "name",
        message: "Name",
        type: "input",
        default: trunkFromDB.name
      },
      {
        name: "accessControlListRef",
        message: "ACL",
        type: "list",
        choices: aclChoices,
        default: trunkFromDB.accessControlListRef
      },
      {
        name: "inboundCredentialsRef",
        message: "Inbound Credentials",
        type: "list",
        choices: credentialsChoice,
        default: trunkFromDB.inboundCredentialsRef
      },
      {
        name: "outboundCredentialsRef",
        message: "Outbound Credentials",
        type: "list",
        choices: credentialsChoice,
        default: trunkFromDB.outboundCredentialsRef
      },
      {
        type: "loop",
        name: "uris",
        message: "Add an Outbound URI?",
        questions: [
          {
            name: "host",
            message: "Host",
            type: "input"
          },
          {
            name: "port",
            message: "Post",
            type: "input",
            default: 5060
          },
          {
            name: "transport",
            message: "Transport",
            type: "list",
            choices: [
              CC.Transport.UDP,
              CC.Transport.TCP,
              CC.Transport.TLS,
              CC.Transport.WS,
              CC.Transport.WSS
            ],
            default: CC.Transport.UDP
          },
          {
            name: "user",
            message: "User Part",
            type: "input"
          },
          {
            name: "priority",
            message: "Priority",
            type: "number",
            default: 0
          },
          {
            name: "weight",
            message: "Weight",
            type: "number",
            default: 10
          }
        ]
      } /*
      {
        name: "confirm",
        message: "Ready?",
        type: "confirm"
      }*/
    ])

    answers.ref = args.ref

    // if (!answers.confirm) {
    //   this.warn("Aborted")
    // } else {
    try {
      CliUx.ux.action.start(`Updating Trunk ${answers.name}`)
      const trunk = await api.updateTrunk(answers)
      await CliUx.ux.wait(1000)
      CliUx.ux.action.stop(trunk.ref)
    } catch (e) {
      CliUx.ux.action.stop()
      throw new CLIError(e.message)
    }
    // }
  }
}
