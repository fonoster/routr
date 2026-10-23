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
import * as path from "path"
import * as fs from "fs"
import { tmpdir } from "os"
import chai from "chai"
import { captureOutput } from "@oclif/test"
import { Config } from "@oclif/core"
import { loadTrace, TraceExit, TraceLoadError } from "../src/trace/load"
import { alignTraces, analyze, labelOf, recordDiff } from "../src/trace/model"
import { ASCII, pickGlyphs, UNICODE } from "../src/trace/glyphs"
import {
  fitAddress,
  fitBranch,
  fitCallId,
  fitUri,
  fmtMs,
  wrap
} from "../src/trace/text"
import { initialState, paintScreen, visibleRows } from "../src/trace/paint"
import { renderStatic } from "../src/trace/static"
import { listLength, problemIndices, reduce } from "../src/trace/app"
import ReplayCommand from "../src/commands/trace/replay"
import ValidateCommand from "../src/commands/trace/validate"

const expect = chai.expect
const FIX = path.join(__dirname, "fixtures")
const A = path.join(FIX, "call-2.18.0.jsonl")
const B = path.join(FIX, "call-2.15.4.jsonl")

const quoted = (text: string) => `"${text}"`
const VERSION_1 = `${quoted("traceVersion")}:1`
const VERSION_2 = `${quoted("traceVersion")}:2`

const tmp = (name: string, content: string) => {
  const file = path.join(tmpdir(), name)
  fs.writeFileSync(file, content)
  return file
}

describe("@routr/ctl trace", () => {
  describe("load", () => {
    it("reads a valid file", () => {
      const loaded = loadTrace(A)
      expect(loaded.records).to.have.length(11)
      expect(loaded.truncatedLines).to.equal(0)
    })

    it("maps errors to exit codes", () => {
      expect(() => loadTrace(path.join(FIX, "nope.jsonl")))
        .to.throw(TraceLoadError, "cannot read nope.jsonl: no such file")
        .with.property("exit", TraceExit.UNREADABLE)
      expect(() => loadTrace(tmp("empty.jsonl", "\n\n")))
        .to.throw("empty.jsonl has no records")
        .with.property("exit", TraceExit.UNREADABLE)
      const lines = fs.readFileSync(A, "utf8").split("\n").filter(Boolean)
      const future = lines
        .map((l) => l.replace(VERSION_1, VERSION_2))
        .join("\n")
      expect(() => loadTrace(tmp("future.jsonl", future)))
        .to.throw(
          "future.jsonl is trace version 2; this rctl reads version 1. Upgrade rctl"
        )
        .with.property("exit", TraceExit.UNSUPPORTED_VERSION)
      expect(() => loadTrace(tmp("nottrace.jsonl", `{${quoted("hello")}:1}`)))
        .to.throw("nottrace.jsonl is not a Routr trace")
        .with.property("exit", TraceExit.UNSUPPORTED_VERSION)
      expect(() =>
        loadTrace(tmp("bad.jsonl", `${lines[0]}\n{not json}\n${lines[1]}`))
      )
        .to.throw("bad.jsonl line 2: invalid JSON")
        .with.property("exit", TraceExit.UNREADABLE)
      const broken = lines[0].replace(
        `${quoted("outcome")}:${quoted("rejected")}`,
        `${quoted("outcome")}:${quoted("lost")}`
      )
      expect(() => loadTrace(tmp("schema.jsonl", broken))).to.throw("/outcome")
    })

    it("tolerates a truncated last line and says so", () => {
      const lines = fs.readFileSync(A, "utf8").split("\n").filter(Boolean)
      const loaded = loadTrace(
        tmp("cut.jsonl", `${lines[0]}\n${lines[1]}\n${lines[2].slice(0, 50)}`)
      )
      expect(loaded.records).to.have.length(2)
      expect(loaded.truncatedLines).to.equal(1)
      expect(loaded.totalLines).to.equal(3)
      const m = analyze(loaded)
      expect(m.verdict.line).to.include("incomplete")
    })
  })

  describe("model", () => {
    const a = analyze(loadTrace(A))
    const b = analyze(loadTrace(B))

    it("derives lanes, verdict and facts", () => {
      expect(a.lanes.map((l) => l.title)).to.deep.equal([
        "1001",
        "edgeport-01",
        "trunk-01"
      ])
      expect(a.verdict.word).to.equal("FORWARDED")
      expect(a.verdict.line).to.match(
        /^FORWARDED {2}16\.1 ms {2}11 messages {2}0 rejected {2}1 warning$/
      )
      expect(b.verdict.word).to.equal("REJECTED")
      expect(b.verdict.line).to.include(
        "REJECTED 500 at +1681 ms  re-INVITE c1 from trunk-01"
      )
      expect(Object.fromEntries(a.facts)).to.include({
        Direction: "agent-to-pstn",
        Trunk: "trunk-01",
        EdgePort: "edgeport-01 2.18.0"
      })
    })

    it("runs the checks, failures first", () => {
      expect(a.checks.map((c) => c.state)).to.deep.equal([
        "warn",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass"
      ])
      expect(b.checks[0]).to.include({ state: "fail" })
      expect(b.checks.map((c) => c.text)).to.include(
        "2 P-Asserted-Identity headers reach the trunk"
      )
      expect(a.checksNote).to.equal(
        "checks cover the first forwarded INVITE; 2 more INVITEs in this call"
      )
    })

    it("labels messages and folds retransmissions", () => {
      expect(a.rows.map((r) => r.inLeg.label)).to.deep.equal([
        "INVITE c1",
        "INVITE c2",
        "INVITE c2",
        "180 Ringing",
        "200 OK",
        "ACK c2",
        "re-INVITE c1",
        "200 OK",
        "ACK c1",
        "BYE c3",
        "200 OK"
      ])
      expect(a.rows[1].retransmissions).to.equal(1)
      expect(a.rows[2].retransOf).to.equal(1)
      expect(a.rows[0].mark).to.equal("challenge")
      expect(a.rows[0].outLeg).to.include({ to: 0, label: "401 Unauthorized" })
      expect(b.rows[6]).to.include({ mark: "fail", rejected: true })
      expect(b.rows[6].outLeg).to.include({
        to: 2,
        label: "500 Server Internal Error"
      })
      expect(visibleRows(a, initialState())).to.have.length(10)
      expect(
        visibleRows(a, { ...initialState(), showRetrans: true })
      ).to.have.length(11)
      expect(
        visibleRows(a, { ...initialState(), filter: "5xx" })
      ).to.have.length(0)
      expect(
        visibleRows(b, { ...initialState(), filter: "5xx" })
      ).to.have.length(1)
      expect(
        visibleRows(a, { ...initialState(), filter: "bye" })
      ).to.have.length(2)
      expect(labelOf(a.records[6])).to.equal("re-INVITE c1")
    })

    it("attributes the record diff to the hop that made it", () => {
      const rows = recordDiff(a.records[1])
      expect(rows[0]).to.include({
        kind: "changed",
        name: "Request-URI",
        by: "connect-processor"
      })
      expect(rows.map((r) => r.kind)).to.satisfy((kinds: string[]) => {
        const order = ["changed", "added", "removed"]
        return kinds.every(
          (k, i) => i === 0 || order.indexOf(k) >= order.indexOf(kinds[i - 1])
        )
      })
      expect(rows.find((r) => r.name === "Authorization")).to.include({
        kind: "removed"
      })
      expect(rows.find((r) => r.name === "X-Gateway-Auth")?.value).to.equal(
        "REDACTED"
      )
    })

    it("lines up two files and says why rows differ", () => {
      const rows = alignTraces(a.records, b.records)
      expect(rows.map((r) => r.state)).to.deep.equal([
        "same",
        "differs",
        "differs",
        "same",
        "same",
        "same",
        "differs",
        "onlyA",
        "onlyA",
        "same",
        "same"
      ])
      expect(rows[1].why).to.match(/P-Asserted-Identity/)
      expect(rows[6].why).to.equal("outcome forwarded vs rejected")
    })
  })

  describe("text", () => {
    it("fits URIs, branches, Call-IDs and addresses by their rules", () => {
      expect(fitUri("sip:17853178070@sip.provider.net:7060", 34)).to.equal(
        "sip:17853178070@…provider.net:7060"
      )
      expect(fitUri("sip:17853178070@sip.provider.net:7060", 30)).to.equal(
        "sip:17853178070@…ider.net:7060"
      )
      expect(fitUri("sip:17853178070@sip.provider.net:7060", 40)).to.equal(
        "sip:17853178070@sip.provider.net:7060"
      )
      expect(fitBranch("z9hG4bK-353730-e6d92929a1", 12)).to.equal(
        "…-e6d92929a1"
      )
      expect(fitCallId("a9f3c1e2d4b5@10.111.221.22", 20)).to.equal(
        "a9f3c…@10.111.221.22"
      )
      expect(fitAddress("10.111.221.22:5506/UDP", 19)).to.equal(
        "10.111.221.22:5506"
      )
      expect(fmtMs(681)).to.equal("681")
      expect(fmtMs(12345)).to.equal("12.345s")
      expect(fmtMs(62000)).to.equal("1m02s")
      expect(
        wrap("Record-Route names 10.111.221.2, an internal interface", 30, 2)
      ).to.deep.equal([
        "Record-Route names",
        "  10.111.221.2, an internal",
        "  interface"
      ])
    })

    it("picks ASCII glyphs for dumb terminals and non-UTF-8 locales", () => {
      expect(
        pickGlyphs(false, { TERM: "xterm-256color", LANG: "en_US.UTF-8" })
      ).to.equal(UNICODE)
      expect(pickGlyphs(false, { TERM: "dumb" })).to.equal(ASCII)
      expect(pickGlyphs(false, { LANG: "C" })).to.equal(ASCII)
      expect(pickGlyphs(true, {})).to.equal(ASCII)
    })
  })

  describe("screen", () => {
    const a = analyze(loadTrace(A))
    const b = analyze(loadTrace(B))
    const text = (lines: { text: string }[][]) =>
      lines.map((l) => l.map((s) => s.text).join("")).join("\n")

    it("paints exactly rows lines at every width and never wider than columns", () => {
      ;[80, 100, 120, 160].forEach((columns) => {
        ;[0, 1, 2, 3].forEach((view) => {
          const l = { columns, rows: 24, g: UNICODE }
          const lines = paintScreen(
            a,
            b,
            { ...initialState(view), selected: 1 },
            l
          )
          expect(lines, `view ${view} at ${columns}`).to.have.length(24)
          lines.forEach((line) =>
            expect(
              line.map((s) => s.text).join("").length,
              `view ${view} at ${columns}`
            ).to.be.at.most(columns)
          )
        })
      })
    })

    it("refuses a terminal below 80x20", () => {
      const lines = paintScreen(a, b, initialState(), {
        columns: 72,
        rows: 20,
        g: UNICODE
      })
      expect(text(lines)).to.include("needs at least 80×20 (now 72×20)")
    })

    it("places the pane by width and expands hops inline", () => {
      const s = { ...initialState(1), selected: 1, expanded: 1 }
      const wide = text(
        paintScreen(a, b, s, { columns: 120, rows: 30, g: UNICODE })
      )
      expect(wide).to.include("│ record 2")
      expect(wide).to.include("├ connect-pr")
      const mid = text(
        paintScreen(a, b, s, { columns: 100, rows: 30, g: UNICODE })
      )
      expect(mid).to.include("── record 2 · INVITE c2 · forwarded ──")
      const narrow = text(
        paintScreen(a, b, s, { columns: 80, rows: 30, g: UNICODE })
      )
      expect(narrow).to.not.include("record 2 ·")
    })

    it("reads in ASCII", () => {
      const s = { ...initialState(1), selected: 1 }
      const out = text(
        paintScreen(b, undefined, s, { columns: 100, rows: 30, g: ASCII })
      )
      expect(out).to.include("-INVITE c2 x2")
      expect(out).to.match(/x\s+\+1681/)
      expect(out).to.not.match(/[─╌▶◀✓✗]/)
    })
  })

  describe("keys", () => {
    const a = analyze(loadTrace(A))
    const b = analyze(loadTrace(B))
    const ctx = (s: ReturnType<typeof initialState>) => ({
      a,
      b,
      rows: 20,
      columns: 120,
      listLength: listLength(a, b, s),
      problems: problemIndices(a, b, s)
    })
    const press = (
      s: ReturnType<typeof initialState>,
      input: string,
      key: Record<string, boolean> = {}
    ) => {
      const next = reduce(s, input, key, ctx(s))
      if (next === "quit") throw new Error("quit")
      return next
    }

    it("switches views, moves the selection and expands", () => {
      let s = initialState()
      s = press(s, "2")
      expect(s.view).to.equal(1)
      s = press(s, "j")
      s = press(s, "j")
      expect(s.selected).to.equal(2)
      s = press(s, "G")
      expect(s.selected).to.equal(9)
      s = press(s, "", { return: true })
      expect(s.expanded).to.equal(10)
      s = press(s, "d")
      expect(s.paneMode).to.equal("diff")
      s = press(s, "", { tab: true })
      expect(s.view).to.equal(2)
      s = press(s, "[")
      expect(s.view).to.equal(1)
      expect(reduce(s, "q", {}, ctx(s))).to.equal("quit")
    })

    it("jumps to problems and explains checks", () => {
      let s = initialState()
      s = press(s, "n")
      expect(s.checkIndex).to.equal(0)
      expect(s.message).to.include("Record-Route")
      s = press(s, "n")
      expect(s.message).to.equal("no more problems")
      const bs = (x: ReturnType<typeof initialState>) =>
        reduce(
          x,
          "n",
          {},
          {
            a: b,
            b: undefined,
            rows: 20,
            columns: 120,
            listLength: listLength(b, undefined, x),
            problems: problemIndices(b, undefined, x)
          }
        )
      const ladder = bs(initialState(1)) as ReturnType<typeof initialState>
      // The folded retransmission is not a visible row, so the 500 is row 5
      expect(ladder.selected).to.equal(5)
      expect(bs(ladder)).to.include({ message: "no more problems" })
    })

    it("filters and refuses compare without a file", () => {
      let s = initialState(1)
      s = press(s, "/")
      s = press(s, "5")
      s = press(s, "x")
      s = press(s, "x")
      s = press(s, "", { return: true })
      expect(s.filter).to.equal("5xx")
      s = press(s, "", { escape: true })
      expect(s.filter).to.equal("")
      const noB = reduce(
        initialState(),
        "4",
        {},
        { a, b: undefined, rows: 20, columns: 120, listLength: 0, problems: [] }
      )
      expect(noB).to.include({
        view: 0,
        message: "no second file loaded; run with --compare <file>"
      })
    })
  })

  describe("static", () => {
    const a = analyze(loadTrace(A))
    const b = analyze(loadTrace(B))

    it("prints the identity lines, no trailing spaces, max 120 columns", () => {
      const out = renderStatic(a, b, { view: "all", columns: 200, g: UNICODE })
      expect(out.split("\n")[1]).to.equal(
        "routr trace  call-2.18.0.jsonl  Call-ID 1-25@10.111.221.22"
      )
      expect(out).to.include("──── compare ")
      expect(out).to.include("≠ A2 B2")
      out.split("\n").forEach((line) => {
        expect(line).to.equal(line.replace(/\s+$/, ""))
        expect(line.length).to.be.at.most(120)
      })
      expect(out.endsWith("\n")).to.equal(true)
    })

    it("prints the selected record's hops and diff on the ladder page", () => {
      const out = renderStatic(a, undefined, {
        view: "ladder",
        columns: 100,
        select: 7,
        g: UNICODE
      })
      expect(out).to.include("record 7 · re-INVITE c1 · forwarded")
      expect(out).to.include("diff  re-INVITE c1  in → out")
      expect(out).to.include("├ connect-pr")
    })
  })

  describe("commands", () => {
    let config: Config
    before(async () => {
      config = await Config.load(path.join(__dirname, ".."))
    })

    it("replay --static prints the summary page", async () => {
      const { stdout } = await captureOutput(async () =>
        ReplayCommand.run([A, "--static", "--columns", "100"], config)
      )
      expect(stdout).to.include("FORWARDED  16.1 ms  11 messages")
      expect(stdout).to.include("─INVITE c2 ×2")
    })

    it("replay exits 3 on a version it cannot read and 4 with --fail-on", async () => {
      const lines = fs.readFileSync(B, "utf8").split("\n").filter(Boolean)
      const future = tmp(
        "future2.jsonl",
        lines.map((l) => l.replace(VERSION_1, VERSION_2)).join("\n")
      )
      const { error } = await captureOutput(async () =>
        ReplayCommand.run([future, "--static"], config)
      )
      expect(error?.message).to.include(
        "is trace version 2; this rctl reads version 1"
      )
      expect((error as { oclif?: { exit?: number } })?.oclif?.exit).to.equal(3)
      const failed = await captureOutput(async () =>
        ReplayCommand.run([B, "--static", "--fail-on", "rejected"], config)
      )
      expect(
        (failed.error as { oclif?: { exit?: number } })?.oclif?.exit
      ).to.equal(4)
      const fine = await captureOutput(async () =>
        ReplayCommand.run([A, "--static", "--fail-on", "rejected"], config)
      )
      expect(fine.error).to.equal(undefined)
    })

    it("validate reports the record count or the first problem", async () => {
      const ok = await captureOutput(async () =>
        ValidateCommand.run([A], config)
      )
      expect(ok.stdout).to.include(
        "call-2.18.0.jsonl: 11 records, trace version 1, Call-ID 1-25@10.111.221.22"
      )
      const bad = await captureOutput(async () =>
        ValidateCommand.run([tmp("v.jsonl", `{${VERSION_1}}`)], config)
      )
      expect(bad.error?.message).to.include("v.jsonl line 1:")
    })
  })
})
