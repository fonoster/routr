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
import { existsSync, readdirSync, readFileSync, statSync } from "fs"
import { join, relative, resolve } from "path"
import { load as parseYaml } from "js-yaml"
import { Trace } from "../src"

const expect = chai.expect

// The known-good corpora at the repository root: the SEET recordings in
// etc/corpus and one directory per partner under interop/. Every file must be
// listed, named by the convention, readable by this build, and trip exactly
// the rule findings its manifest line declares. No services are needed here;
// the replay through the chain is `npm run compat`.
const ROOT = join(__dirname, "..", "..", "..")
const CORPUS = join(ROOT, "etc", "corpus")
const INTEROP = join(ROOT, "interop")

const loadManifest = (dir: string) =>
  Trace.parseManifest(
    parseYaml(readFileSync(join(dir, "manifest.yaml"), "utf8"))
  )

const recordingsIn = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()

const partnerDirs = () =>
  existsSync(INTEROP)
    ? readdirSync(INTEROP)
        .filter((f) => statSync(join(INTEROP, f)).isDirectory())
        .sort()
        .map((f) => join(INTEROP, f))
    : []

const describeCorpus = (dir: string) => {
  describe(`${relative(ROOT, dir)} known-good recordings`, () => {
    const manifest = loadManifest(dir)

    it("lists every recording in the directory, and only existing ones", () => {
      const listed = manifest.files.map((f) => f.file).sort()
      expect(listed).to.deep.equal(recordingsIn(dir))
      expect(existsSync(join(dir, manifest.resources))).to.equal(true)
    })

    manifest.files.forEach((entry) => {
      it(`${entry.file} is valid and trips only its declared findings`, () => {
        const records = Trace.parseTrace(
          readFileSync(join(dir, entry.file), "utf8")
        )
        expect(records.length).to.be.greaterThan(0)
        expect(new Set(records.map((r) => r.callId)).size).to.equal(1)
        const fired = new Set<string>()
        const detail: string[] = []
        Trace.Rules.evaluateAll(records, { profiles: entry.profiles }).forEach(
          (fs, seq) =>
            fs.forEach((f) => {
              fired.add(f.rule)
              detail.push(`seq ${seq} ${f.rule}: ${f.message}`)
            })
        )
        expect(Array.from(fired).sort(), detail.join("\n")).to.deep.equal(
          entry.findings
        )
      })
    })
  })
}

describeCorpus(CORPUS)

describe("etc/corpus holds the SEET fixtures only", () => {
  const manifest = loadManifest(CORPUS)

  it("has at least one recording that replays and one that faces a provider", () => {
    expect(manifest.files.some((f) => f.replay)).to.equal(true)
    expect(
      manifest.files.some((f) => f.profiles.includes(Trace.Profile.SIP_CONNECT))
    ).to.equal(true)
  })

  it("holds no partner recording", () => {
    const isPartner = (f: string) => f.startsWith("sipjs_")
    expect(recordingsIn(CORPUS).filter(isPartner)).to.deep.equal([])
    expect(manifest.files.map((f) => f.file).filter(isPartner)).to.deep.equal(
      []
    )
  })
})

describe("interop partner directories", () => {
  it("has at least one partner directory", () => {
    expect(partnerDirs()).to.not.be.empty
  })

  partnerDirs().forEach((dir) => {
    const name = relative(ROOT, dir)

    it(`${name} has a manifest when it holds recordings`, () => {
      if (recordingsIn(dir).length > 0) {
        expect(existsSync(join(dir, "manifest.yaml"))).to.equal(true)
      }
    })

    it(`${name} replays with the shared etc/corpus/resources`, () => {
      expect(resolve(dir, loadManifest(dir).resources)).to.equal(
        join(CORPUS, "resources")
      )
    })
  })
})

partnerDirs()
  .filter((dir) => existsSync(join(dir, "manifest.yaml")))
  .forEach(describeCorpus)
