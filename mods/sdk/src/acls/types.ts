/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import { CreateBaseOmit, Flatten } from "../types"

export type CreateAclRequest = Omit<CC.AccessControlList, CreateBaseOmit>

export type CreateAclResponse = Flatten<CC.AccessControlList>

export type UpdateAclRequest = Flatten<
  { ref: string } & Partial<CreateAclRequest>
>

export type UpdateAclResponse = Flatten<CC.AccessControlList>

export type ListAclRequest = Flatten<CC.ListRequest>

export type ListAclResponse = Flatten<CC.ListResponse<CC.AccessControlList>>

export type GetAclResponse = Flatten<CC.AccessControlList>
