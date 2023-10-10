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
import { CommonConnect as CC } from "@routr/common"
import { CreateBaseOmit } from "../types"

export type CreateTrunkRequest = Omit<
  CC.Trunk,
  | CreateBaseOmit
  | "accessControlList"
  | "inboundCredentials"
  | "outboundCredentials"
>

export type CreateTrunkResponse = CC.Trunk

export type UpdateTrunkRequest = { ref: string } & Partial<CreateTrunkRequest>

export type UpdateTrunkResponse = CC.Trunk

export type ListTrunkRequest = CC.ListRequest

export type ListTrunkResponse = CC.ListResponse<CC.Trunk>

export type GetTrunkResponse = CC.Trunk
