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
import * as grpc from "@grpc/grpc-js"
import { JsonData } from "../../types"
import { Kind } from "../types"

export interface DataAPIOptions {
  apiAddr: string
  credentials?: grpc.ChannelCredentials
}

export interface ServiceAPIOptions {
  apiAddr: string
  kind: Kind
  credentials?: grpc.ChannelCredentials
}

export interface FindByRequest {
  fieldName: string
  fieldValue: string | boolean | number
}

export interface ListRequest {
  pageSize: number
  pageToken: string
}

export interface ListResponse<R> {
  items: R[]
  nextPageToken: string
}

export interface FindByResponse<R> {
  items: R[]
}

export type APIClient = {
  agents: ServiceAPI
  domains: ServiceAPI
  trunks: ServiceAPI
  credentials: ServiceAPI
  acl: ServiceAPI
  peers: ServiceAPI
  numbers: ServiceAPI
}

export type ServiceAPI = {
  create: <R extends { extended?: JsonData }>(request: JsonData) => Promise<R>
  update: <R extends { extended?: JsonData }>(request: JsonData) => Promise<R>
  get: <R extends { extended?: JsonData }>(ref: string) => Promise<R>
  del: (ref: string) => Promise<void>
  list: <R extends { extended?: JsonData }>(request: {
    pageSize: number
    pageToken: string
  }) => Promise<ListResponse<R>>
  findBy: <R>(request: FindByRequest) => Promise<FindByResponse<R>>
}
