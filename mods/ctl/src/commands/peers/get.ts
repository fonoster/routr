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
import { Args, Command, Errors, Flags, Interfaces } from "@oclif/core"
import { printTable } from "../../lib/table"
import * as grpc from "@grpc/grpc-js"
import { BaseCommand } from "../../base"
import {
  getTextForBalancingAlgorithm,
  showPaginatedList,
  ShowTable
} from "../../utils"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"

export default class GetCommand extends BaseCommand {
  static readonly description =
    "Shows a list of paginated Peers or a single Peer if ref is provided"

  static readonly examples = [
    `<%= config.bin %> <%= command.id %>
Ref                                  Name                Username   AOR                      Max Contacts   Balancing Algorithm Session Affinity 
6f941c63-880c-419a-a72a-4a107cbaf5c5 Asterisk Conference conference sip:conference@sip.local 1              Round Robin         Yes 
`
  ]

  static readonly flags = {
    size: Flags.integer({
      char: "s",
      description: "the number of items to return",
      default: 50
    }),
    extended: Flags.boolean({
      char: "x",
      description: "extended output format"
    })
  }

  static args = {
    ref: Args.string({
      required: false,
      description: "optional reference to a Peer"
    })
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GetCommand)

    const showTable: ShowTable = (request: {
      showHeader: boolean
      data: Record<string, unknown>[]
      self: Command
      flags: Record<string, unknown>
    }) => {
      const { showHeader, data, self, flags } = request
      printTable(
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
          aor: {
            header: "AOR"
          },
          maxContacts: {
            header: "Max Contacts",
            get: (row: { maxContacts: number }) =>
              row.maxContacts === -1 ? "" : row.maxContacts
          },
          balancingAlgorithm: {
            header: "Balancing Algorithm",
            get: (row: { balancingAlgorithm: string }) =>
              getTextForBalancingAlgorithm(
                row.balancingAlgorithm as CT.LoadBalancingAlgorithm
              )
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
      kind: CC.Kind.PEER,
      self: this
    })
  }

  async catch(
    error: { code: number; message: string } | Interfaces.CommandError
  ) {
    // To be handled globally
    if ("code" in error && error.code === grpc.status.NOT_FOUND) {
      const { args } = await this.parse(GetCommand)
      throw new Errors.CLIError(
        "the Peer you are looking for does not exist: " + args.ref
      )
    }
    throw new Errors.CLIError(error.message)
  }
}
