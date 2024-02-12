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
import { JsonObject } from "pb-util/build"

export default class GetNumbersCommand extends BaseCommand {
  static readonly description =
    "Shows a list of paginated Numbers or a single Number if ref is provided"

  static readonly examples = [
    `<%= config.bin %> <%= command.id %>
Ref                                  Name           Telephony URL      AOR Link           Geo              
a134487f-a668-4509-9ddd-dcbc98175468 (785) 317-8070 +17853178070       sip:1001@sip.local Cameron, USA (US)
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
      description: "optional reference to a Number"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GetNumbersCommand)

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
          telUrl: {
            header: "Telephony URL"
          },
          aorLink: {
            header: "AOR Link"
          },
          sessionAffinityHeader: {
            header: "Session Affinity Header",
            extended: true
          },
          geo: {
            header: "Geo",
            // Combine city, country and countryIsoCode
            get: (row: JsonObject) =>
              `${row.city}, ${row.country} (${row.countryIsoCode})`
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
      kind: CC.Kind.NUMBER,
      self: this
    })
  }

  async catch(error: { code: number; message: string } | CommandError) {
    // To be handled globally
    if ("code" in error && error.code === grpc.status.NOT_FOUND) {
      const { args } = await this.parse(GetNumbersCommand)
      throw new CLIError(
        "the Number you are looking for does not exist: " + args.ref
      )
    }
    throw new CLIError(error.message)
  }
}
