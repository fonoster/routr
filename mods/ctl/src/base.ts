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

export abstract class BaseCommand extends Command {
  static readonly globalFlags = {
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
      default: "localhost:51908"
    })
  }
}
