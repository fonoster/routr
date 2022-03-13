/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import { Backend, Route } from "./types"

export const expiredFilter = (r: Route) => 
  (r.expires - (Date.now() - r.registeredOn) / 1000) > 0

export const duplicateFilter = (r1: Route, r2: Route) => 
  !(r1.host === r2.host && r1.port === r2.port)

export const mergeKeyValue = (map: Map<string, string>) => Array.from(map).map(l => l[0] + l[1])

export const compareArrays = (arr: string[], target: string[]) => 
  target.every(v => arr.includes(v)) && arr.length === target.length

export const filterOnlyMatchingLabels = (requestLabels: Map<string, string>) => 
  (route: Route) => route.labels
    ? compareArrays(mergeKeyValue(requestLabels), mergeKeyValue(route.labels))
    : false

export const hasAffinitySession = (backend: Backend) => backend?.sessionAffinity?.enabled
