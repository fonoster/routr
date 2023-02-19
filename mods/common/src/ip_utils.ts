/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
 *
 * Licensed under the MIT License (the "License")
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
import {
  cidrInfo,
  isValidIpv4,
  isValidIpv6,
  subnet,
  subnetInfo
} from "ip-utils"

export const formatNet = (net: string) => {
  if (net.split("/").length === 1) {
    if (isValidIpv4(net)) return `${net}/32`
    if (isValidIpv6(net)) return `${net}/128`
    throw new Error("Invalid address! Must be a valid Ipv4 or Ipv6")
  }
  const p1 = net.split("/")[0]
  const p2 = net.split("/")[1]
  return isValidIpv4(p2)
    ? `${p1}/${subnetInfo(p1, p2).cidrMask}`
    : `${p1}/${p2}`
}

export const hasIp = (net: string, addr: string) =>
  subnet(formatNet(net)).contains(addr)

export const addressCount = (net: string) =>
  cidrInfo(formatNet(net)).inclusiveNumberHosts

export const isLocalnet = (nets: string[], addr: string) =>
  nets?.filter((net) => hasIp(net, addr)).length > 0

export const getLocalnetIp = (nets: string[], addr: string) =>
  nets?.filter((net) => hasIp(net, addr))[0]?.split("/")[0]
