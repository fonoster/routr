/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/fonoster
 *
 * This file is part of Fonoster
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
import { Args, Errors, ux } from "@oclif/core"
import { BaseCommand } from "./base"
import { wait } from "./lib/wait"

export default abstract class DeleteCommand extends BaseCommand {
  static readonly args = {
    ref: Args.string({ required: false })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async deleteResource(API: any, funcName: string) {
    const { args } = await this.parse(DeleteCommand)
    if (!args.ref) {
      ux.action.stop()
      throw new Errors.CLIError(
        "You must provide a resource ref before continuing"
      )
    }

    ux.action.start(`Deleting item ${args.ref}`)
    try {
      await API[funcName](args.ref)
      await wait(1000)
      ux.action.stop("Done")
    } catch (e) {
      throw new Errors.CLIError(e.message)
    }
  }

  async catch(err: Error) {
    return super.catch(err)
  }

  async finally(err: Error) {
    return super.finally(err)
  }
}
