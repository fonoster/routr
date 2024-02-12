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
import { Kind } from "../types"
import Ajv from "ajv"
import ACLSchema from "./acl"
import AgentSchema from "./agent"
import CredentialsSchema from "./crendentials"
import DomainSchema from "./domain"
import NumberSchema from "./number"
import PeerSchema from "./peer"
import TrunkSchema from "./trunk"

const validator = (schema: object) => new Ajv().compile(schema)
const schemaValidators = new Map()
schemaValidators.set(Kind.ACL, validator(ACLSchema))
schemaValidators.set(Kind.AGENT, validator(AgentSchema))
schemaValidators.set(Kind.CREDENTIALS, validator(CredentialsSchema))
schemaValidators.set(Kind.DOMAIN, validator(DomainSchema))
schemaValidators.set(Kind.NUMBER, validator(NumberSchema))
schemaValidators.set(Kind.PEER, validator(PeerSchema))
schemaValidators.set(Kind.TRUNK, validator(TrunkSchema))

export { schemaValidators }
