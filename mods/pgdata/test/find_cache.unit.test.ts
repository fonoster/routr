/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
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
import chai from "chai"
import sinon from "sinon"
import sinonChai from "sinon-chai"
import { createFindCache } from "../src/cache/create_find_cache"

const expect = chai.expect
chai.use(sinonChai)

describe("@routr/pgdata/cache/create_find_cache", () => {
  const notEmpty = () => false
  const empty = () => true

  it("serves a repeated lookup from memory until it expires", async () => {
    let time = 0
    const cache = createFindCache({
      ttlSeconds: 100,
      negativeTtlSeconds: 10,
      now: () => time,
      random: () => 0.5
    })
    const load = sinon.stub().resolves(["agent"])

    expect(await cache.getOrLoad("k", load, notEmpty)).to.deep.equal(["agent"])
    expect(await cache.getOrLoad("k", load, notEmpty)).to.deep.equal(["agent"])
    expect(load).to.have.been.calledOnce

    time = 100 * 1000 + 1
    await cache.getOrLoad("k", load, notEmpty)
    expect(load).to.have.been.calledTwice
  })

  it("keeps an empty answer for the shorter time", async () => {
    let time = 0
    const cache = createFindCache({
      ttlSeconds: 100,
      negativeTtlSeconds: 10,
      now: () => time,
      random: () => 0.5
    })
    const load = sinon.stub().resolves([])

    await cache.getOrLoad("k", load, empty)
    time = 10 * 1000 + 1
    await cache.getOrLoad("k", load, empty)

    expect(load).to.have.been.calledTwice
  })

  it("spreads the expiry so entries don't all expire together", async () => {
    let time = 0
    const late = createFindCache({
      ttlSeconds: 100,
      negativeTtlSeconds: 10,
      now: () => time,
      random: () => 1
    })
    const load = sinon.stub().resolves(["x"])

    await late.getOrLoad("k", load, notEmpty)
    time = 110 * 1000
    await late.getOrLoad("k", load, notEmpty)

    // At the top of the range an entry lives 20% longer
    expect(load).to.have.been.calledOnce
  })

  it("loads a key once for every caller waiting on it", async () => {
    const cache = createFindCache({ ttlSeconds: 100, negativeTtlSeconds: 10 })
    const load = sinon
      .stub()
      .callsFake(
        () => new Promise((resolve) => setTimeout(() => resolve(["x"]), 5))
      )

    const results = await Promise.all([
      cache.getOrLoad("k", load, notEmpty),
      cache.getOrLoad("k", load, notEmpty),
      cache.getOrLoad("k", load, notEmpty)
    ])

    expect(results).to.deep.equal([["x"], ["x"], ["x"]])
    expect(load).to.have.been.calledOnce
  })

  it("forgets everything when cleared", async () => {
    const cache = createFindCache({ ttlSeconds: 100, negativeTtlSeconds: 10 })
    const load = sinon.stub().resolves(["x"])

    await cache.getOrLoad("k", load, notEmpty)
    expect(cache.size()).to.equal(1)
    cache.clear()
    await cache.getOrLoad("k", load, notEmpty)

    expect(cache.size()).to.equal(1)
    expect(load).to.have.been.calledTwice
  })

  it("doesn't keep a load that failed", async () => {
    const cache = createFindCache({ ttlSeconds: 100, negativeTtlSeconds: 10 })
    const load = sinon.stub()
    load.onFirstCall().rejects(new Error("connection refused"))
    load.onSecondCall().resolves(["x"])

    await cache.getOrLoad("k", load, notEmpty).catch((): void => undefined)
    expect(cache.size()).to.equal(0)
    expect(await cache.getOrLoad("k", load, notEmpty)).to.deep.equal(["x"])
    expect(load).to.have.been.calledTwice
  })

  it("doesn't keep a load that began before a write", async () => {
    const cache = createFindCache({ ttlSeconds: 100, negativeTtlSeconds: 10 })
    let release: (value: string[]) => void = () => undefined
    const load = sinon
      .stub()
      .onFirstCall()
      .returns(
        new Promise<string[]>((resolve) => {
          release = resolve
        })
      )
      .onSecondCall()
      .resolves(["after"])

    const pending = cache.getOrLoad("agent|username|1001", load, notEmpty)
    cache.invalidate("agent", { username: "1001" })
    release(["before"])

    expect(await pending).to.deep.equal(["before"])
    expect(cache.size()).to.equal(0)
    expect(
      await cache.getOrLoad("agent|username|1001", load, notEmpty)
    ).to.deep.equal(["after"])
  })

  it("serves but doesn't keep answers once full of live entries", async () => {
    const cache = createFindCache({
      ttlSeconds: 100,
      negativeTtlSeconds: 10,
      maxEntries: 2
    })
    const load = sinon.stub().resolves(["x"])

    await cache.getOrLoad("a", load, notEmpty)
    await cache.getOrLoad("b", load, notEmpty)
    expect(await cache.getOrLoad("c", load, notEmpty)).to.deep.equal(["x"])

    expect(cache.size()).to.equal(2)
  })

  it("drops the written row and the kinds that embed it, nothing else", async () => {
    const cache = createFindCache({
      ttlSeconds: 100,
      negativeTtlSeconds: 10,
      embeddedBy: { trunk: ["trunk", "number", "agent"] }
    })
    const load = sinon.stub().resolves(["x"])
    const keys = [
      "agent|username|1001",
      "agent|username|1002",
      "number|telUrl|tel:+1",
      "domain|domainUri|sip.local",
      "trunk|inboundUri|t1.acme.com",
      "trunk|inboundUri|t2.acme.com"
    ]
    await Promise.all(keys.map((k) => cache.getOrLoad(k, load, notEmpty)))

    // An Agent write drops only that Agent
    cache.invalidate("agent", { ref: "agent-01", username: "1001" })
    await Promise.all(keys.map((k) => cache.getOrLoad(k, load, notEmpty)))
    expect(load.callCount).to.equal(keys.length + 1)

    // A Trunk write drops every Trunk, Number and Agent, but no Domain
    cache.invalidate("trunk", { ref: "trunk-01", inboundUri: "t1.acme.com" })
    await Promise.all(keys.map((k) => cache.getOrLoad(k, load, notEmpty)))
    expect(load.callCount).to.equal(keys.length + 1 + 5)
  })

  it("rejects a lifetime that isn't a positive number", () => {
    expect(() =>
      createFindCache({ ttlSeconds: 0, negativeTtlSeconds: 10 })
    ).to.throw("ttlSeconds must be a positive number")
    expect(() =>
      createFindCache({ ttlSeconds: 10, negativeTtlSeconds: -1 })
    ).to.throw("negativeTtlSeconds must be a positive number")
  })
})
