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
import SDK from "@routr/sdk"
import moment from "moment"

export default class DescribeCommand extends BaseCommand {
  static description = "show details of a Domain"
  static args = [
    {
      name: "ref",
      required: false,
      description: "reference to the Domain"
    }
  ]

  async run() {
    const { args, flags } = await this.parse(DescribeCommand)
    const { endpoint, insecure, cacert } = flags
    const api = new SDK.Domains({ endpoint, insecure, cacert })

    try {
      const domain = await api.getDomain(args.ref)

      const jsonObj = {
        Ref: domain.ref,
        APIVersion: domain.apiVersion,
        Name: domain.name,
        URI: domain.domainUri,
        "Access Control List": domain.accessControlList
          ? {
              Ref: domain.accessControlList.ref,
              Name: domain.accessControlList.name,
              Deny: domain.accessControlList.deny.join(","),
              Allow: domain.accessControlList.allow.join(",")
            }
          : "None",
        // TODO: Extend to show the Tel Url
        "Egress Policies":
          domain.egressPolicies.length > 0
            ? domain.egressPolicies.map((p) => {
                return {
                  Rule: p.rule,
                  "Number Ref": p.numberRef
                }
              })
            : "None",
        Extended: domain.extended,
        Created: moment(new Date(domain.createdAt * 1000)).toISOString(),
        Updated: moment(new Date(domain.updatedAt * 1000)).toISOString()
      }

      this.log(render(jsonObj, { noColor: true }))
    } catch (e) {
      throw new CLIError(e.message)
    }
  }
}
