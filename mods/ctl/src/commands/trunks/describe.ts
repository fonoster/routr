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
import { BaseCommand } from "../../base"
import { CLIError } from "@oclif/core/lib/errors"
import { render } from "prettyjson"
import SDK from "@routr/sdk"
import moment from "moment"

export default class DescribeCommand extends BaseCommand {
  static description = "shows details for a Trunk"
  static args = [
    {
      name: "ref",
      required: false,
      description: "reference to the Trunk"
    }
  ]

  async run() {
    const { args, flags } = await this.parse(DescribeCommand)
    const { endpoint, insecure, cacert } = flags
    const api = new SDK.Trunks({ endpoint, insecure, cacert })

    try {
      const trunk = await api.getTrunk(args.ref)

      const jsonObj = {
        Ref: trunk.ref,
        APIVersion: trunk.apiVersion,
        Name: trunk.name,
        "Inbound URI": trunk.inboundUri,
        "Access Control List": trunk.accessControlList
          ? {
              Ref: trunk.accessControlList.ref,
              Name: trunk.accessControlList.name,
              Deny: trunk.accessControlList.deny.join(","),
              Allow: trunk.accessControlList.allow.join(",")
            }
          : "None",
        "Inbound Credentials": trunk.inboundCredentials
          ? {
              Ref: trunk.inboundCredentials.ref,
              Username: trunk.inboundCredentials.username
            }
          : "None",
        "Outbound Credentials": trunk.outboundCredentials
          ? {
              Ref: trunk.outboundCredentials.ref,
              Username: trunk.outboundCredentials.username
            }
          : "None",
        "Outbound URIs":
          trunk.uris
            .map(
              (uri) =>
                `${uri.host}:${uri.port} [transport=${uri.transport};weight=${uri.weight};priority=${uri.priority}]`
            )
            .join(",") || "None",
        "Send Register": trunk.sendRegister,
        Extended: trunk.extended,
        Created: moment(new Date(trunk.createdAt * 1000)).toISOString(),
        Updated: moment(new Date(trunk.updatedAt * 1000)).toISOString()
      }

      this.log(render(jsonObj, { noColor: true }))
    } catch (e) {
      throw new CLIError(e.message)
    }
  }
}
