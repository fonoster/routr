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
import { CommonConnect as CC } from "@routr/common"
import { JsonObject } from "pb-util/build"

export interface PostgresDataConfig {
  bindAddr: string
}

export type DBDelegate =
  | Exclude<Exclude<CC.Kind, CC.Kind.UNKNOWN>, CC.Kind.ACL>
  | "accessControlList"

export type PrismaOperation = (request: {
  where: {
    ref: string
  }
  include?: JsonObject
}) => unknown

export type PrismaFindByOperation = (request: {
  where: {
    [key: string]: boolean | string | number
  }
  include?: JsonObject
}) => unknown

export type PrismaListOperation = (request: {
  take: number
  skip: number
  cursor: {
    ref: string
  }
  orderBy: JsonObject
  include?: JsonObject
}) => unknown

export type PrismaCreateOperation = (request: {
  data: any
  include?: JsonObject
}) => unknown

export type PrismaUpdateOperation = (request: {
  where: {
    ref: string
  }
  data: unknown
  include?: JsonObject
}) => unknown
