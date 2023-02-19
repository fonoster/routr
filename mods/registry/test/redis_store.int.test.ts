/*
 * Copyright (C) 2023 by Fonoster Inc (https://fonoster.com)
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
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import RedisStore from "../src/redis_store"
import { RegistrationEntry, RegistrationEntryStatus } from "../src/types"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/registry/redis_store", () => {
  afterEach(() => sandbox.restore())

  it("puts value in the store", async () => {
    const store = new RedisStore()
    const entry1: RegistrationEntry = {
      trunkRef: "trunk-01",
      timeOfEntry: Date.now(),
      retentionTimeInSeconds: 120,
      status: RegistrationEntryStatus.REGISTERED
    }
    const entry2: RegistrationEntry = {
      trunkRef: "tky767x2",
      // Very old entry
      timeOfEntry: 1661701508130,
      retentionTimeInSeconds: 10,
      status: RegistrationEntryStatus.QUARANTINE
    }
    store.put(entry1.trunkRef, entry1)
    store.put(entry2.trunkRef, entry2)

    expect((await store.list()).length).to.be.equal(2)
    expect(await store.get("trunk-01"))
      .to.have.property("status")
      .to.be.equal(RegistrationEntryStatus.REGISTERED)
  })
})
