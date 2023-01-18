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
import { CommonConnect as CC } from "@routr/common"
import { CreateBaseOmit } from "../types"

export type CreateDomainRequest = Omit<
  CC.Domain,
  CreateBaseOmit | "accessControlList" | "egressPolicies"
> & { egressPolicies?: Omit<CC.EgressPolicy, "number">[] }

export type CreateDomainResponse = CC.Domain

export type UpdateDomainRequest = { ref: string } & Partial<
  Omit<CreateDomainRequest, "domainUri">
>

export type UpdateDomainResponse = CC.Domain

export type ListDomainRequest = CC.ListRequest

export type ListDomainResponse = CC.ListResponse<CC.Domain>

export type GetDomainResponse = CC.Domain
