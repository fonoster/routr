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
import protoLoader = require("@grpc/proto-loader")
import { toPascaleCase } from "../helper"
import { Kind, KindWithoutUnknown } from "./types"

const protoOptions = {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
}

function getProtoPath(kind: Kind): string {
  switch (kind) {
    case Kind.ACL:
      return __dirname + "/protos/acl.proto"
    case Kind.CREDENTIALS:
      return __dirname + "/protos/credentials.proto"
    default:
      return __dirname + `/protos/${kind}s.proto`
  }
}

export function createConnectClient(options: {
  kind: Kind
  credentials: grpc.ChannelCredentials
  apiAddr: string
}) {
  const def = protoLoader.loadSync(getProtoPath(options.kind), protoOptions)
  const descriptor = grpc.loadPackageDefinition(def) as any
  const base = descriptor.fonoster.routr.connect

  switch (options.kind) {
    case Kind.ACL:
      return new base.acl.v2draft1.ACLService(
        options.apiAddr,
        options.credentials
      )
    case Kind.CREDENTIALS:
      return new base.credentials.v2draft1.CredentialsService(
        options.apiAddr,
        options.credentials
      )
    default:
      return new base[options.kind + "s"].v2draft1[
        toPascaleCase(options.kind) + "s"
      ](options.apiAddr, options.credentials)
  }
}

export function createConnectService(kind: KindWithoutUnknown) {
  const def = protoLoader.loadSync(getProtoPath(kind), protoOptions)
  const descriptor = grpc.loadPackageDefinition(def) as any
  const base = descriptor.fonoster.routr.connect

  switch (kind) {
    case Kind.ACL:
      return base.acl.v2draft1.ACLService.service
    case Kind.CREDENTIALS:
      return base.credentials.v2draft1.CredentialsService.service
    default:
      return base[kind + "s"].v2draft1[toPascaleCase(kind) + "s"].service
  }
}
