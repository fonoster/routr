/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
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
import * as grpc from "@grpc/grpc-js"
import { JsonObject, struct } from "pb-util"
import { ClientConnectionError } from "../../errors"
import { createConnectClient } from "../client"
import { Kind } from "../types"
import {
  APIClient,
  DataAPIOptions,
  FindByRequest,
  FindByResponse,
  ListRequest,
  ListResponse,
  ServiceAPI,
  ServiceAPIOptions
} from "./types"

type GrpcError = { code: number }

function fire(err: GrpcError, apiAddr: string, isSecure: boolean) {
  if (err.code === grpc.status.UNAVAILABLE) {
    return new ClientConnectionError(apiAddr, isSecure)
  }
  return err
}

export function apiClient(options: DataAPIOptions): APIClient {
  return {
    agents: serviceAPI({ kind: Kind.AGENT, ...options }),
    domains: serviceAPI({ kind: Kind.DOMAIN, ...options }),
    trunks: serviceAPI({ kind: Kind.TRUNK, ...options }),
    credentials: serviceAPI({ kind: Kind.CREDENTIALS, ...options }),
    acl: serviceAPI({ kind: Kind.ACL, ...options }),
    peers: serviceAPI({ kind: Kind.PEER, ...options }),
    numbers: serviceAPI({ kind: Kind.NUMBER, ...options })
  }
}

export function serviceAPI<R>(options: ServiceAPIOptions): ServiceAPI<R> {
  const { kind, apiAddr, credentials, metadata } = options

  // Workaround for issue not allowing to pass metadata to grpc-js
  const meta = new grpc.Metadata()

  if (metadata) {
    Object.keys(metadata.toJSON()).forEach((key) => {
      meta.set(key, metadata.getMap()[key])
    })
  }

  const clientCredentials = credentials ?? grpc.credentials.createInsecure()

  const client = createConnectClient({
    kind,
    apiAddr,
    credentials: clientCredentials
  })

  const isSecure = clientCredentials._isSecure()

  return {
    create: <R extends { extended?: JsonObject }>(request: JsonObject) =>
      new Promise<R>((resolve, reject) => {
        if (request.extended) {
          request.extended = struct.encode(
            request.extended as JsonObject
          ) as JsonObject
        }

        client.create(request, meta, (err: GrpcError, response: R) => {
          if (err) {
            return reject(fire(err, apiAddr, isSecure))
          }

          if (response.extended) {
            response.extended = struct.decode(response.extended)
          }

          resolve(response)
        })
      }),

    update: <R extends { extended?: JsonObject }>(request: JsonObject) =>
      new Promise<R>((resolve, reject) => {
        if (request.extended) {
          request.extended = struct.encode(
            request.extended as JsonObject
          ) as JsonObject
        }

        client.update(request, meta, (err: GrpcError, response: R) => {
          if (err) {
            return reject(fire(err, apiAddr, isSecure))
          }

          if (response.extended) {
            response.extended = struct.decode(response.extended)
          }

          resolve(response)
        })
      }),

    get: <R extends { extended?: JsonObject }>(ref: string) =>
      new Promise<R>((resolve, reject) => {
        client.get({ ref }, meta, (err: GrpcError, response: R) => {
          if (err) {
            return reject(fire(err, apiAddr, isSecure))
          }

          if (response.extended) {
            response.extended = struct.decode(response.extended)
          }

          resolve(response)
        })
      }),

    list: <R extends { extended?: JsonObject }>(request: ListRequest) =>
      new Promise<ListResponse<R>>((resolve, reject) => {
        client.list(
          request,
          meta,
          (err: GrpcError, response: ListResponse<R>) => {
            if (err) {
              return reject(fire(err, apiAddr, isSecure))
            }

            response.items.forEach((item: { extended?: JsonObject }) => {
              if (item.extended) {
                item.extended = struct.decode(item.extended)
              }
            })

            resolve({
              items: response?.items ?? [],
              nextPageToken: response.nextPageToken
            })
          }
        )
      }),

    findBy: <R>(request: FindByRequest) =>
      new Promise<FindByResponse<R>>((resolve, reject) => {
        client.findBy(
          request,
          meta,
          (err: GrpcError, response: FindByResponse<R>) => {
            if (err) {
              return reject(fire(err, apiAddr, isSecure))
            }

            response.items.forEach((item: { extended?: JsonObject }) => {
              if (item.extended) {
                item.extended = struct.decode(item.extended)
              }
            })

            resolve(response)
          }
        )
      }),

    del: (ref: string) =>
      new Promise((resolve, reject) => {
        client.delete({ ref }, meta, (err: GrpcError) =>
          err ? reject(fire(err, apiAddr, isSecure)) : resolve()
        )
      })
  }
}
