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
import DeleteCommand from "../../delete"
import SDK from "@routr/sdk"

export default class DeleteNumberCommand extends DeleteCommand {
  static description = "Deletes a Number"

  static examples = [
    `<%= config.bin %> <%= command.id %>
Deleting item 80181ca6-d4aa-4575-9375-8f72b071111... Done
`
  ]

  async run() {
    const { flags } = await this.parse(DeleteNumberCommand)
    const { endpoint, insecure } = flags
    await super.deleteResource(
      new SDK.Numbers({ endpoint, insecure }),
      "deleteNumber"
    )
  }
}
