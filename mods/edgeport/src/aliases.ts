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
/**
 * The hostnames this EdgePort answers to, sent to the processors in every
 * request so they can tell a Route that names Routr from one that doesn't.
 * Like EXTERNAL_ADDRS, the environment wins over the config. Blank entries
 * are dropped: routr-one passes `aliases: []` on as an empty ALIASES.
 *
 * @param {string[]} fromEnv - the ALIASES environment variable, split on ","
 * @param {string[]} fromConfig - spec.aliases
 * @return {string[]} the aliases, empty when neither sets any
 */
export const getAliases = (
  fromEnv: string[],
  fromConfig: string[] | undefined
): string[] => {
  const env = fromEnv.filter((alias) => alias.length > 0)
  return env.length > 0 ? env : fromConfig ?? []
}
