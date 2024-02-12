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
import { CliUx, Command, Flags } from "@oclif/core"
import { BaseCommand } from "../../base"
import { showPaginatedList, ShowTable } from "../../utils"
import { CommonConnect as CC } from "@routr/common"
import { CLIError } from "@oclif/core/lib/errors"
import { CommandError } from "@oclif/core/lib/interfaces"

export default class GetDomainsCommand extends BaseCommand {
  static readonly description =
    "Shows a list of paginated Domains or a single Domain if ref is provided"

  static readonly examples = [
    `<%= config.bin %> <%= command.id %>
Ref                                  Name         URI            
ab2b6959-f497-4b14-903b-85a7c464b564 Local Domain sip.local
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

  static args = [
    {
      name: "ref",
      required: false,
      description: "optional reference to a Domain"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GetDomainsCommand)

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
          domainUri: {
            header: "URI"
          },
          egressPolicies: {
            header: "Egress Policies",
            get: (row: {
              egressPolicies: { rule: string; number: CC.INumber }[]
            }) =>
              row.egressPolicies
                .map((p) => `${p.rule}/${p.number.telUrl.split("tel:")[1]}`)
                .join(", "),
            extended: true
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
      kind: CC.Kind.DOMAIN,
      self: this
    })
  }

  async catch(error: { code: number; message: string } | CommandError) {
    // To be handled globally
    if ("code" in error && error.code === grpc.status.NOT_FOUND) {
      const { args } = await this.parse(GetDomainsCommand)
      throw new CLIError(
        "the Domain you are looking for does not exist: " + args.ref
      )
    }
    throw new CLIError(error.message)
  }
}
