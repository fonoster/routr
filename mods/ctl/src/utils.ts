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
import { Command } from "@oclif/core"
import { CommonConnect as CC, CommonTypes as CT } from "@routr/common"
import SDK from "@routr/sdk"

// NOTE: Newer versions of inquirer have a bug that causes the following error:
// (node:75345) [ERR_REQUIRE_ESM] Error Plugin: @routr/ctl [ERR_REQUIRE_ESM]: require() of ES Module
import inquirer from "inquirer"

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export const stringToACL = (aclRule: string) =>
  aclRule.split(",").map((rule: string) => rule.trim())

type APIName =
  | "ACL"
  | "Credentials"
  | "Domains"
  | "Agents"
  | "Peers"
  | "Trunks"
  | "Numbers"

export type ShowTable = (request: {
  showHeader: boolean
  data: Record<string, unknown>[]
  self: Command
  flags: Record<string, unknown>
}) => void

function getFunctionMapping(kind: CC.Kind): {
  api: APIName
  get: string
  list: string
} {
  switch (kind) {
    case CC.Kind.ACL:
      return { api: "ACL", get: "getACL", list: "listACLs" }
    case CC.Kind.CREDENTIALS:
      return {
        api: "Credentials",
        get: "getCredentials",
        list: "listCredentials"
      }
    case CC.Kind.DOMAIN:
    case CC.Kind.AGENT:
    case CC.Kind.PEER:
    case CC.Kind.TRUNK:
    case CC.Kind.NUMBER:
      return {
        api: `${capitalize(kind)}s` as APIName,
        get: `get${capitalize(kind)}`,
        list: `list${capitalize(kind)}s`
      }
  }
}

export async function showPaginatedList(request: {
  showTable: ShowTable
  args: Record<string, string>
  flags: Record<string, unknown>
  kind: CC.Kind
  self: Command
}) {
  const { showTable, args, flags, kind, self } = request
  const api = new SDK[getFunctionMapping(kind).api as unknown as APIName]({
    endpoint: flags.endpoint as string,
    insecure: flags.insecure as boolean,
    cacert: flags.cacert as string
  })

  // Show single item
  if (args.ref) {
    const result = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (api as any)[getFunctionMapping(kind).get](args.ref)
    ] as unknown as Record<string, unknown>[]

    showTable({ showHeader: true, data: result, self, flags })
    return
  }

  let firstBatch = true
  let pageToken = ""
  const pageSize = flags.size

  // eslint-disable-next-line no-loops/no-loops, no-constant-condition
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (api as any)[getFunctionMapping(kind).list]({
      pageSize: pageSize as number,
      pageToken
    })
    const list = result.items as unknown as Record<string, unknown>[]
    pageToken = result.nextPageToken

    // Dont ask this if is the first time or empty data
    if (list.length > 0 && !firstBatch) {
      const answer = await inquirer.prompt([
        { name: "q", message: "More", type: "confirm" }
      ])
      if (!answer.q) break
    }

    if (list.length < 1) break

    showTable({ showHeader: firstBatch, data: list, self, flags })

    firstBatch = false
    if (!pageToken) break
  }
}

export function toPascalCase(s: string) {
  return s.replace(/(\w)(\w*)/g, function (g0, g1, g2) {
    return g1.toUpperCase() + g2.toLowerCase()
  })
}

export function stringToHeaders(headers: string) {
  return headers
    .split(",")
    .filter((header: string) => header)
    .map((header: string) => {
      const [name, value] = header.split(":")
      return { name, value }
    })
}

export function getTextForBalancingAlgorithm(
  balancingAlgorithm: CT.LoadBalancingAlgorithm
): string {
  return balancingAlgorithm === CT.LoadBalancingAlgorithm.ROUND_ROBIN
    ? "Round Robin"
    : "Least Connections"
}
