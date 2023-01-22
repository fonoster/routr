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
// import { Help } from "@oclif/plugin-help"

import { Help } from "@oclif/core"
import * as figlet from "figlet"

export default class MyHelpClass extends Help {
  protected async showRootHelp() {
    this.showLogo()

    this.log(this.formatRoot())
    this.log()

    this.log(this.formatCommands(this.customCommands))
    this.log()
  }

  private showLogo() {
    this.log("\x1b[32m")
    this.log(
      figlet.textSync("Routr", {
        horizontalLayout: "default",
        verticalLayout: "default",
        width: 60,
        whitespaceBreak: true
      })
    )
    this.log("\x1b[0m")
  }

  private get customCommands() {
    const removeLastDot = (s: string) => {
      const str = s.split("\n")[0].trim()
      return str.endsWith(".") ? str.slice(0, str.length - 1) : s
    }

    const lowercaseFirstLetter = (s: string) =>
      s.charAt(0).toLowerCase() + s.slice(1)

    return this.sortedCommands
      .filter((c) => c.id)
      .sort((a, b) => (a.id.includes(":") ? 1 : b.id.includes(":") ? -1 : 0))
      .map((c) => {
        const { description } = c
        return {
          ...c,
          description: removeLastDot(lowercaseFirstLetter(description))
        }
      })
  }
}
