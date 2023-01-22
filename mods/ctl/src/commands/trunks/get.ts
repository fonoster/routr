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
import { showPaginatedList, ShowTable } from "../../utils"
import { CommonConnect as CC } from "@routr/common"
import { CLIError } from "@oclif/core/lib/errors"
import { CommandError } from "@oclif/core/lib/interfaces"
import { JsonObject } from "pb-util/build"

export default class GetTrunksCommand extends BaseCommand {
  static description =
    "Shows a list of paginated Trunks or a single Trunk if ref is provided"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Ref                                  Name   Inbound SIP URI 
8cde8ea9-3c58-4dbe-b2cf-23c4413dd4cc Local  sip.t01.provider.net
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
      description: "optional reference to a Trunk"
    }
  ]

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GetTrunksCommand)

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
          inboundUri: {
            header: "Inbound SIP URI"
          },
          accessControlListRef: {
            header: "IP Access Control List",
            get: (row: { accessControlList: CC.AccessControlList }) =>
              row.accessControlList?.name || "None",
            extended: true
          },
          inboundCredentialsRef: {
            header: "Inbound Credentials Name",
            get: (row: { inboundCredentials: CC.Credentials }) =>
              row.inboundCredentials?.name || "None",
            extended: true
          },
          outboundCredentialsRef: {
            header: "Outbound Credentials Name",
            get: (row: { outboundCredentials: CC.Credentials }) =>
              row.outboundCredentials?.name || "None",
            extended: true
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
      kind: CC.Kind.TRUNK,
      self: this
    })
  }

  async catch(error: { code: number; message: string } | CommandError) {
    // To be handled globally
    if ("code" in error && error.code === grpc.status.NOT_FOUND) {
      const { args } = await this.parse(GetTrunksCommand)
      throw new CLIError(
        "the Trunk you are looking for does not exist: " + args.ref
      )
    }
    throw new CLIError(error.message)
  }
}
