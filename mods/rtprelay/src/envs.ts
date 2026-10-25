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
export const DEFAULT_BIND_ADDR = "0.0.0.0:51903"
export const DEFAULT_RTPENGINE_PORT = 22222

// The configuration file is optional, and RTPENGINE_HOST may come from it, so
// nothing is asserted here; the runner checks once the file is read. An
// environment variable, when set, still wins over the file.
export const CONFIG_PATH = process.env.CONFIG_PATH
export const BIND_ADDR = process.env.BIND_ADDR
export const RTPENGINE_HOST = process.env.RTPENGINE_HOST
export const RTPENGINE_PORT = process.env.RTPENGINE_PORT
  ? parseInt(process.env.RTPENGINE_PORT)
  : undefined
export const RTPENGINE_TIMEOUT = parseInt(
  process.env.RTPENGINE_TIMEOUT ?? "5000"
)
