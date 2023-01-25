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
import { CliUx, Command, Flags } from "@oclif/core"
import { BaseCommand } from "../../base"
import { capitalize, showPaginatedList, ShowTable } from "../../utils"
import { CommonConnect as CC } from "@routr/common"
import { CLIError } from "@oclif/core/lib/errors"
import { CommandError } from "@oclif/core/lib/interfaces"
import { CommonTypes as CT } from "@routr/common"

export default class GetAgentsCommand extends BaseCommand {
  static description =
    "Shows a list of paginated Agents or a single Agent if ref is provided"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Ref                                  Name     Username Domain    Privacy Enabled
d31f5fb8-e367-42f7-9884-1a7999f53fe8 John Doe jdoe     sip.local PRIVATE Yes
`
  ]

  static flags = {
    size: Flags.integer({
      char: "s",
      description: "The number of items to return",
      default: 50
    }),
    extended: Flags.boolean({
      char: "x",
      description: "extended output format"
    })
  }

  static args = [
    {
      name: "ref",
      required: false,
      description: "Optional Agents reference"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GetAgentsCommand)

    const showTable: ShowTable = (request: {
      showHeader: boolean
      data: Record<string, unknown>[]
      self: Command
      flags: Record<string, unknown>
    }) => {
      const { showHeader, data, self, flags } = request
      CliUx.ux.table(
        data,
        {
          ref: {
            minWidth: 7,
            extended: true
          },
          name: {
            minWidth: 7
          },
          username: {
            header: "Username"
          },
          domain: {
            header: "Domain",
            get: (row: { domain: CC.Domain }) => row.domain?.domainUri || "None"
          },
          privacy: {
            header: "Privacy",
            get: (row: { privacy: CT.Privacy }) => capitalize(row.privacy)
          },
          enabled: {
            header: "Enabled",
            get: (row: { enabled: boolean }) => (row.enabled ? "Yes" : "No")
          }
        },
        {
          "no-header": !showHeader,
          printLine: self.log.bind(self),
          ...flags // parsed flags
        }
      )
    }

    await showPaginatedList({
      showTable,
      args,
      flags,
      kind: CC.Kind.AGENT,
      self: this
    })
  }

  async catch(error: { code: number; message: string } | CommandError) {
    // To be handled globally
    if ("code" in error && error.code === grpc.status.NOT_FOUND) {
      const { args } = await this.parse(GetAgentsCommand)
      throw new CLIError(
        "the Agent you are looking for does not exist: " + args.ref
      )
    }
    throw new CLIError(error.message)
  }
}
