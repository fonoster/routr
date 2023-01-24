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
import {
  hostValidator,
  inboundUriValidator,
  nameValidator,
  optionalUsernameValidator,
  portValidator,
  priorityValidator,
  weightValidator
} from "../../validators"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export default class CreateTrunkCommand extends BaseCommand {
  static description = "Creates a new Trunk"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Creating Trunk T01... b148b4b4-6884-4c06-bb7e-bd098f5fe793
`
  ]

  async run(): Promise<void> {
    const { flags } = await this.parse(CreateTrunkCommand)
    const { endpoint, insecure } = flags

    try {
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

      this.log("This utility will help you create a new Trunk.")
      this.log("Press ^C at any time to quit.")

      const group1 = await inquirer.prompt([
        {
          name: "name",
          message: "Friendly Name",
          type: "input",
          validate: nameValidator
        },
        {
          name: "inboundUri",
          message: "Inbound SIP URI",
          type: "input",
          validate: inboundUriValidator
        },
        {
          name: "accessControlListRef",
          message: "IP Access Control List",
          type: "list",
          choices: [{ name: "None", value: undefined }, ...aclChoices]
        },
        {
          name: "inboundCredentialsRef",
          message: "Inbound Credentials",
          type: "list",
          choices: [{ name: "None", value: undefined }, ...credentialsChoice]
        },
        {
          name: "outboundCredentialsRef",
          message: "Outbound Credentials",
          type: "list",
          choices: [{ name: "None", value: undefined }, ...credentialsChoice]
        },
        {
          name: "addOutboundUri",
          message: "Add an Outbound SIP URI?",
          type: "confirm",
          default: false
        }
      ])

      const group2Questions = [
        {
          name: "host",
          message: "Host",
          type: "input",
          validate: hostValidator
        },
        {
          name: "port",
          message: "Post",
          type: "input",
          default: "5060",
          validate: portValidator
        },
        {
          name: "transport",
          message: "Transport",
          type: "list",
          choices: [CT.Transport.UDP, CT.Transport.TCP, CT.Transport.TLS],
          default: CT.Transport.UDP
        },
        {
          name: "user",
          message: "User Part",
          type: "input",
          validate: optionalUsernameValidator
        },
        {
          name: "priority",
          message: "Priority",
          type: "input",
          default: "10",
          validate: priorityValidator
        },
        {
          name: "weight",
          message: "Weight",
          type: "input",
          default: "10",
          validate: weightValidator
        },
        {
          name: "addOutboundUri",
          message: "Add another Outbound SIP URI?",
          type: "confirm",
          default: false
        }
      ]

      let addOutboundUri = group1.addOutboundUri
      const uris: CC.TrunkURI[] = []

      // eslint-disable-next-line no-loops/no-loops
      while (addOutboundUri) {
        const group2 = await inquirer.prompt(group2Questions)
        if (group2.numberRef) {
          uris.push({
            host: group2.host,
            port: group2.port,
            transport: group2.transport,
            user: group2.user,
            priority: group2.priority,
            weight: group2.weight,
            enabled: true
          })
        }

        addOutboundUri = group2.addOutboundUri
      }

      const group3 = await inquirer.prompt([
        {
          name: "confirm",
          message: "Ready?",
          type: "confirm"
        }
      ])

      if (!group3.confirm) {
        this.warn("Aborted")
      } else {
        CliUx.ux.action.start(`Creating Trunk ${group1.name}`)
        const api = new SDK.Trunks({ endpoint, insecure })
        const trunk = await api.createTrunk({
          ...group1,
          uris
        })
        await CliUx.ux.wait(1000)
        CliUx.ux.action.stop(trunk.ref)
      }
    } catch (e) {
      CliUx.ux.action.stop()
      if (e.code === grpc.status.ALREADY_EXISTS) {
        throw new CLIError("This Trunk already exist")
      } else {
        throw new CLIError(e.message)
      }
    }
  }
}
