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
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import MemoryStore from "../src/memory_store"
import { RegistrationEntry, RegistrationEntryStatus } from "../src/types"

const expect = chai.expect
chai.use(sinonChai)
const sandbox = sinon.createSandbox()

describe("@routr/registry/memory_store", () => {
  afterEach(() => sandbox.restore())

  it("puts value in the store", async () => {
    const store = new MemoryStore()
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
      retentionTimeInSeconds: 120,
      status: RegistrationEntryStatus.QUARANTINE
    }
    store.put(entry1.trunkRef, entry1)
    store.put(entry2.trunkRef, entry2)
    expect((await store.list()).length).to.be.equal(1)

    store.cleanup()
    expect((await store.list()).length).to.be.equal(1)
    expect(await store.get("trunk-01")).to.have.property("status")
    expect((await store.list())[0]).to.have.property("status")
    expect(await store.get("tk6t67r2")).to.be.null
  })
})
