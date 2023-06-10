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
import { MessageDispatcherConfig } from "@routr/dispatcher"
import { LocationConfig, CacheProvider } from "@routr/location"
import { ConnectProcessorConfig } from "@routr/connect"
import { PostgresDataConfig } from "@routr/pgdata"
import { Method } from "@routr/common"
import { RTPENGINE_HOST, RTPENGINE_PORT } from "./envs"

export const dispatcherConfig: MessageDispatcherConfig = {
  bindAddr: "0.0.0.0:51901",
  processors: [
    {
      ref: "connect-processor",
      addr: "localhost:51904",
      matchFunc: () => true,
      methods: [
        Method.REGISTER,
        Method.INVITE,
        Method.ACK,
        Method.BYE,
        Method.CANCEL
      ]
    }
  ],
  middlewares: [
    {
      ref: "rtprelay-middleware",
      addr: "localhost:51903",
      postProcessor: true
    }
  ]
}

export const connectConfig: ConnectProcessorConfig = {
  bindAddr: "0.0.0.0:51904",
  locationAddr: "location:51902",
  apiAddr: "localhost:51907"
}

export const locationConfig: LocationConfig = {
  bindAddr: "0.0.0.0:51902",
  cache: { provider: CacheProvider.MEMORY }
}

export const rtprelayConfig = {
  host: RTPENGINE_HOST,
  port: RTPENGINE_PORT
}

export const apiServerConfig: PostgresDataConfig = {
  bindAddr: "0.0.0.0:51907",
  externalServerBindAddr: "0.0.0.0:51908"
}
