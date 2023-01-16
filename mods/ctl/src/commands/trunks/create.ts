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
import { CommonTypes as CC } from "@routr/common"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class CreateTrunkCommand extends BaseCommand {
  static description = "Creates a new Trunk"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Creating Credentials JDoe Access... b148b4b4-6884-4c06-bb7e-bd098f5fe793
`
  ]

  async run(): Promise<void> {
    const { flags } = await this.parse(CreateTrunkCommand)
    const { endpoint, insecure } = flags

    this.log("This utility will help you create a new Trunk.")
    this.log("Press ^C at any time to quit.")

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
        type: "input"
      },
      {
        name: "inboundUri",
        message: "Inbound URI",
        type: "input"
      },
      {
        name: "accessControlListRef",
        message: "ACL",
        type: "list",
        choices: aclChoices
      },
      {
        name: "inboundCredentialsRef",
        message: "Inbound Credentials",
        type: "list",
        choices: credentialsChoice
      },
      {
        name: "outboundCredentialsRef",
        message: "Outbound Credentials",
        type: "list",
        choices: credentialsChoice
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
      } /* ,
      {
        name: "confirm",
        message: "Ready?",
        type: "confirm"
      }*/
    ])

    // if (!answers.confirm) {
    //   this.warn("Aborted")
    // } else {
    try {
      CliUx.ux.action.start(`Creating Trunk ${answers.name}`)
      const api = new SDK.Trunks({ endpoint, insecure })
      const trunk = await api.createTrunk(answers)
      await CliUx.ux.wait(1000)
      CliUx.ux.action.stop(trunk.ref)
    } catch (e) {
      CliUx.ux.action.stop()
      if (e.code === grpc.status.ALREADY_EXISTS) {
        throw new CLIError("This Trunk already exist")
      } else {
        throw new CLIError(e.message)
      }
    }
    // }
  }
}
