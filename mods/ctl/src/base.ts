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
import { Command, Flags } from "@oclif/core"
import { buildCredentials } from "@routr/sdk"

export abstract class BaseCommand extends Command {
  static readonly baseFlags = {
    insecure: Flags.boolean({
      char: "i",
      description: "allow insecure connections to the routr server",
      default: false
    }),
    cacert: Flags.string({
      char: "c",
      description: "path to the CA certificate to verify the server"
    }),
    endpoint: Flags.string({
      char: "e",
      description: "endpoint to connect to the routr server",
      default: "localhost:51907"
    }),
    "api-key": Flags.string({
      description:
        "API key of the routr server; prefer the environment, which stays out of the shell's history",
      env: "ROUTR_API_KEY"
    })
  }

  // Builds the credentials once before the command runs, so a combination of
  // flags the SDK refuses, or a CA certificate that does not exist, stops the
  // command before it prompts or connects. The statics are read one by one
  // because parse() spreads its argument, which drops the ones a command
  // inherits (the args of the delete commands)
  // eslint-disable-next-line require-jsdoc
  async init(): Promise<void> {
    await super.init()
    const { flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: this.ctor.baseFlags,
      args: this.ctor.args,
      strict: this.ctor.strict
    })

    try {
      buildCredentials({
        endpoint: flags.endpoint as string,
        insecure: flags.insecure as boolean,
        cacert: flags.cacert as string,
        apiKey: flags["api-key"] as string
      })
    } catch (e) {
      // A missing CA certificate keeps the exit code it always had
      const exit = (e as NodeJS.ErrnoException).code === "ENOENT" ? 1 : 2
      this.error((e as Error).message, { exit })
    }
  }
}
