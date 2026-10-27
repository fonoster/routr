#!/usr/bin/env node
/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
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
// Run by the image's CMD before anything else starts; root evals its stdout,
// so it must print nothing but export lines (no logger, no tracer)
import { loadOneConfig } from "./config/load_one_config"
import { printOneEnv } from "./config/print_one_env"

process.exitCode = printOneEnv({
  env: { ...process.env },
  loadConfig: loadOneConfig,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text)
})
