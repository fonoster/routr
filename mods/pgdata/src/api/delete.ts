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
/* eslint-disable require-jsdoc */
import { CommonTypes as CT } from "@routr/common"
import { BadRequestError } from "@routr/common/src/errors"
import { PrismaOperation } from "../types"

// TODO: Fix the error handling. We should return the error
export function del(operation: PrismaOperation) {
  return async (call: CT.GrpcCall, callback: CT.GrpcCallback) => {
    if (!call.request.ref) {
      return callback(new BadRequestError("parameter ref is required"), null)
    }

    try {
      await operation({
        where: {
          ref: call.request.ref
        }
      })
    } catch (e) {
      // Ignore
    }

    callback(null, {})
  }
}
