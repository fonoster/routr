/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
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
import * as protobufUtil from "pb-util"
import { PrismaClient } from "@prisma/client"
import { CommonTypes as CT } from "@routr/common"

const jsonToStruct = protobufUtil.struct.encode
const structToJson = protobufUtil.struct.decode

// eslint-disable-next-line require-jsdoc
export function create(prisma: PrismaClient) {
  return async (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    const { request } = call

    if (request.extended) {
      request.extended = structToJson(request.extended)
    }

    if (request.extended) request.extended = jsonToStruct(request.extended)

    callback(null, request)
  }
}
