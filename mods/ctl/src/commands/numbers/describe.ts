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
  static readonly description = "shows details for a Number"
  static readonly args = [
    {
      name: "ref",
      required: false,
      description: "reference to the Number"
    }
  ]

  async run() {
    const { args, flags } = await this.parse(DescribeCommand)
    const { endpoint, insecure, cacert } = flags
    const api = new SDK.Numbers({ endpoint, insecure, cacert })

    try {
      const number = await api.getNumber(args.ref)

      const jsonObj = {
        Ref: number.ref,
        APIVersion: number.apiVersion,
        Name: number.name,
        "Tel URL": number.telUrl,
        "AOR Link": number.aorLink,
        "Trunk Ref": number.trunkRef,
        "Geo Info": {
          City: number.city,
          "Country Name": number.country,
          "Country Code": number.countryIsoCode
        },
        "Session Affinity Header": number.sessionAffinityHeader,
        "Extra Headers": number.extraHeaders
          ? number.extraHeaders.join(",")
          : "None",
        Extended: number.extended,
        Created: moment(number.createdAt).toISOString(),
        Updated: moment(number.updatedAt).toISOString()
      }

      this.log(render(jsonObj, { noColor: true }))
    } catch (e) {
      throw new CLIError(e.message)
    }
  }
}
