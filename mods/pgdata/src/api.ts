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
import { PrismaClient } from "@prisma/client"
import { CommonTypes as CT, CommonErrors as CE } from "@routr/common"

const prisma = new PrismaClient()

// eslint-disable-next-line require-jsdoc
export async function get(call: CT.GrpcCall, callback: CT.GrpcCallback) {
  if (!call.request.ref) {
    return callback(new CE.BadRequestError("parameter ref is required"), null)
  }

  const resource = (await prisma.agent.findUnique({
    where: {
      ref: call.request.ref
    }
  })) as any

  resource
    ? callback(null, resource)
    : callback(new CE.ResourceNotFoundError(call.request.ref), null)
}
