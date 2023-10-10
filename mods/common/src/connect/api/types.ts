/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import * as grpc from "@grpc/grpc-js"
import { JsonObject } from "pb-util/build"
import {
  AccessControlList,
  Agent,
  Credentials,
  Domain,
  INumber,
  Kind,
  Peer,
  Trunk
} from "../types"

export interface DataAPIOptions {
  apiAddr: string
  credentials?: grpc.ChannelCredentials
  metadata?: grpc.Metadata
}

export interface ServiceAPIOptions {
  apiAddr: string
  kind: Kind
  credentials?: grpc.ChannelCredentials
  metadata?: grpc.Metadata
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
  agents: ServiceAPI<Agent>
  domains: ServiceAPI<Domain>
  trunks: ServiceAPI<Trunk>
  credentials: ServiceAPI<Credentials>
  acl: ServiceAPI<AccessControlList>
  peers: ServiceAPI<Peer>
  numbers: ServiceAPI<INumber>
}

export type ServiceAPI<R extends { extended?: JsonObject }> = {
  create: (request: unknown) => Promise<R>
  update: (request: unknown) => Promise<R>
  get: (ref: string) => Promise<R>
  del: (ref: string) => Promise<void>
  list: (request: {
    pageSize: number
    pageToken: string
  }) => Promise<ListResponse<R>>
  findBy: (request: FindByRequest) => Promise<FindByResponse<R>>
}
