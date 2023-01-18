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
import { CliUx, Command, Flags } from "@oclif/core"
import { BaseCommand } from "../../base"
import { showPaginatedList, ShowTable } from "../../utils"
import { CommonConnect as CC } from "@routr/common"
import { CLIError } from "@oclif/core/lib/errors"
import { CommandError } from "@oclif/core/lib/interfaces"
import * as grpc from "@grpc/grpc-js"
import { JsonObject } from "pb-util/build"

export default class GetCommand extends BaseCommand {
  static description =
    "Shows a list of paginated Credentials or a single set if ref is provided"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Ref                                  Name       Deny List Allow List
80181ca6-d4aa-4575-9375-8f72b07d6666 Europe ACL 0.0.0.0/0 10.0.0.25  
`
  ]

  static flags = {
    size: Flags.integer({
      char: "s",
      description: "the number of items to return",
      default: 50
    })
  }

  static args = [
    {
      name: "ref",
      required: false,
      description: "optional reference to a set of Credentials"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GetCommand)

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
            minWidth: 7
          },
          name: {
            minWidth: 7
          },
          username: {
            header: "Username"
          },
          createdAt: {
            header: "Created",
            get: (row: { createdAt: number }) => new Date(row.createdAt * 1000),
            extended: true
          },
          updatedAt: {
            header: "Updated",
            get: (row: { updatedAt: number }) => new Date(row.updatedAt * 1000),
            extended: true
          },
          extended: {
            header: "Extended",
            get: (row: JsonObject) => row.extended || {},
            extended: true
          },
          apiVersion: {
            header: "API",
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
      kind: CC.Kind.CREDENTIALS,
      self: this
    })
  }

  async catch(error: { code: number; message: string } | CommandError) {
    // To be andled globally
    if ("code" in error && error.code === grpc.status.NOT_FOUND) {
      const { args } = await this.parse(GetCommand)
      throw new CLIError(
        "the resource you are looking for does not exist: " + args.ref
      )
    }
    throw new CLIError(error.message)
  }
}
