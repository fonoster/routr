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
import MessageRouter from "./router"
import { MessageRequest, ProcessorConfig } from "./types"

const registerProcessor: ProcessorConfig = {
  ref: "register-processor",
  addr: "192.168.1.3:51902",
  methods: ['REGISTER'],
  matchFunc: (request: MessageRequest) => request.method === 'REGISTER'
}

MessageRouter({
  bindAddr: "0.0.0.0:51901",
  processors: [registerProcessor]
})