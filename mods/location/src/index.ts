/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
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
import { getConfig } from "./config/get_config"
import { CacheProvider, ILocationService, LocationConfig } from "./types"
import locationService from "./service"
import LocationClient from "./client"

export * as Helper from "./helper"
export * as Utils from "./utils"
export * from "./errors"
export * from "./types"

export { LocationClient, ILocationService, getConfig }
export { LocationConfig, CacheProvider, locationService }
