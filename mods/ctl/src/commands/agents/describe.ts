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
import { BaseCommand } from "../../base"
import { CLIError } from "@oclif/core/lib/errors"
import { render } from "prettyjson"
import { capitalize } from "../../utils"
import SDK from "@routr/sdk"
import moment from "moment"

export default class DescribeCommand extends BaseCommand {
  static description = "shows details of an Agent"
  static args = [
    {
      name: "ref",
      required: false,
      description: "reference to the Agent"
    }
  ]

  async run() {
    const { args, flags } = await this.parse(DescribeCommand)
    const { endpoint, insecure } = flags

    const api = new SDK.Agents({ endpoint, insecure })

    try {
      const agent = await api.getAgent(args.ref)

      const jsonObj = {
        Ref: agent.ref,
        APIVersion: agent.apiVersion,
        Name: agent.name,
        Username: agent.username,
        Domain: agent.domain?.domainUri || "None",
        Privacy: capitalize(agent.privacy),
        Credentials: agent.credentials
          ? {
              Ref: agent.credentials.ref,
              Username: agent.credentials.username
            }
          : "None",
        Enabled: agent.enabled ? "Yes" : "No",
        Extended: agent.extended,
        Created: moment(new Date(agent.createdAt * 1000)).toISOString(),
        Updated: moment(new Date(agent.updatedAt * 1000)).toISOString()
      }

      this.log(render(jsonObj, { noColor: true }))
    } catch (e) {
      throw new CLIError(e.message)
    }
  }
}
