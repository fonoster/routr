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
import { existsSync, readdirSync, readFileSync } from "fs"
import { join } from "path"
import { load as parseYaml } from "js-yaml"
import { Trace } from "../src"

const expect = chai.expect

// The known-good corpus at the repository root: every file must be listed,
// named by the convention, readable by this build, and trip exactly the rule
// findings its manifest line declares. No services are needed here; the
// replay through the chain is `npm run compat`.
const CORPUS = join(__dirname, "..", "..", "..", "etc", "corpus")
const MANIFEST = join(CORPUS, "manifest.yaml")

describe("etc/corpus known-good recordings", () => {
  const manifest = Trace.parseManifest(
    parseYaml(readFileSync(MANIFEST, "utf8"))
  )

  it("lists every recording in the directory, and only existing ones", () => {
    const onDisk = readdirSync(CORPUS)
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
    const listed = manifest.files.map((f) => f.file).sort()
    expect(listed).to.deep.equal(onDisk)
    expect(existsSync(join(CORPUS, manifest.resources))).to.equal(true)
  })

  it("has at least one recording that replays and one that faces a provider", () => {
    expect(manifest.files.some((f) => f.replay)).to.equal(true)
    expect(
      manifest.files.some((f) => f.profiles.includes(Trace.Profile.SIP_CONNECT))
    ).to.equal(true)
  })

  manifest.files.forEach((entry) => {
    it(`${entry.file} is valid and trips only its declared findings`, () => {
      const records = Trace.parseTrace(
        readFileSync(join(CORPUS, entry.file), "utf8")
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
