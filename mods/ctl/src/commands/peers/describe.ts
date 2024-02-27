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
import { getTextForBalancingAlgorithm } from "../../utils"
import SDK from "@routr/sdk"
import moment from "moment"

export default class DescribeCommand extends BaseCommand {
  static readonly description = "shows details for a Peer"
  static readonly args = [
    {
      name: "ref",
      required: false,
      description: "reference to the Peer"
    }
  ]

  async run() {
    const { args, flags } = await this.parse(DescribeCommand)
    const { endpoint, insecure, cacert } = flags
    const api = new SDK.Peers({ endpoint, insecure, cacert })

    try {
      const peer = await api.getPeer(args.ref)

      const jsonObj = {
        Ref: peer.ref,
        APIVersion: peer.apiVersion,
        Name: peer.name,
        Username: peer.username,
        AOR: peer.aor,
        "Balancing Algorithm": getTextForBalancingAlgorithm(
          peer.balancingAlgorithm
        ),
        "Session Affinity?": peer.withSessionAffinity ? "Yes" : "No",
        "Contact Address": peer.contactAddr,
        "Max Contacts": peer.maxContacts === -1 ? "" : peer.maxContacts,
        Enabled: peer.enabled ? "Yes" : "No",
        "Access Control List": peer.accessControlList
          ? {
              Ref: peer.accessControlList.ref,
              Name: peer.accessControlList.name,
              Deny: peer.accessControlList.deny.join(","),
              Allow: peer.accessControlList.allow.join(",")
            }
          : "None",
        Credentials: peer.credentials
          ? {
              Ref: peer.credentials.ref,
              Username: peer.credentials.username
            }
          : "None",
        Extended: peer.extended,
        Created: moment(new Date(peer.createdAt * 1000)).toISOString(),
        Updated: moment(new Date(peer.updatedAt * 1000)).toISOString()
      }

      this.log(render(jsonObj, { noColor: true }))
    } catch (e) {
      throw new CLIError(e.message)
    }
  }
}
