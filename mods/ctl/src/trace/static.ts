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
import { Glyphs } from "./glyphs"
import { CallModel, abDiff, alignTraces } from "./model"
import {
  initialState,
  Layout,
  paintCompare,
  paintLadderBody,
  paintPane,
  paintPath,
  paintSummary,
  ladderGeometry,
  ViewState,
  visibleRows
} from "./paint"
import { elideMiddle, Line, textOf, wrap } from "./text"

export type StaticView = "summary" | "ladder" | "path" | "compare" | "all"

export interface StaticOptions {
  view: StaticView
  columns: number
  select?: number
  g: Glyphs
}

const MAX_STATIC_COLUMNS = 120

const plain = (lines: Line[]): string[] =>
  lines.map((l) => textOf(l).replace(/\s+$/, ""))

/**
 * The three identity lines every static page starts with.
 *
 * @param {CallModel} m - Model
 * @param {number} columns - Page width, for the right-aligned verdict
 * @return {string[]} The lines
 */
export function identity(m: CallModel, columns = 100): string[] {
  const first = m.records[0]
  const verdict = m.verdict.short
  // The file name gives way first, so the line never exceeds the page
  const fileRoom = Math.max(
    16,
    columns - "routr. trace  ".length - 2 - verdict.length
  )
  const head = `routr. trace  ${elideMiddle(m.file, fileRoom)}`
  const withId = `${head}  ${m.callId}`
  const left = withId.length + 2 + verdict.length <= columns ? withId : head
  const lines = [
    left +
      " ".repeat(Math.max(2, columns - left.length - verdict.length)) +
      verdict,
    `${first.edgePort.ref} ${
      first.edgePort.version ?? ""
    }  recorded ${m.recordedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}  ${
      m.records.length
    } messages`.replace(/\s+/g, " "),
    m.verdict.line
  ]
  if (m.truncatedLines)
    lines.push(
      `note: last line truncated, ${m.records.length} of ${m.totalLines} records`
    )
  return lines
}

/**
 * Prints one or more views as fixed-width text with no terminal control.
 *
 * @param {CallModel} a - Model A
 * @param {CallModel | undefined} b - Model B
 * @param {StaticOptions} opts - What to print
 * @return {string} The page, with a trailing newline
 */
export function renderStatic(
  a: CallModel,
  b: CallModel | undefined,
  opts: StaticOptions
): string {
  const columns = Math.min(MAX_STATIC_COLUMNS, Math.max(80, opts.columns))
  const l: Layout = { columns, rows: 1000, g: opts.g, plain: true }
  const s: ViewState = {
    ...initialState(),
    selected: -1,
    paneVisible: false,
    showRetrans: false
  }
  const pages: string[][] = []

  const ladder = (withDetail: boolean): string[] => {
    const geo = ladderGeometry(s, l, a.lanes.length, false)
    const rows = visibleRows(a, s)
    const state: ViewState = { ...s, selected: -1 }
    const selectedRow =
      opts.select !== undefined
        ? rows.findIndex((r) => a.records[r.index].seq === opts.select)
        : -1
    if (withDetail && selectedRow >= 0) {
      state.expanded = rows[selectedRow].index
      state.selected = selectedRow
    }
    const lines = plain(paintLadderBody(a, b, state, l, geo).map((x) => x.line))
    if (!withDetail) return lines
    const rec =
      selectedRow >= 0 ? a.records[rows[selectedRow].index] : a.firstForwarded
    if (!rec) return lines
    const paneState: ViewState = { ...s, paneMode: "headers" }
    const head = plain(paintPane(a, b, rec, paneState, columns, l))
    const diff = plain(
      paintPane(a, b, rec, { ...paneState, paneMode: "diff" }, columns, l)
    )
    return [...lines, "", ...head, "", ...diff]
  }

  const want = (v: StaticView) => opts.view === v || opts.view === "all"
  if (want("summary")) {
    pages.push([
      ...identity(a, columns),
      "",
      ...plain(paintSummary(a, s, l).slice(2)),
      "",
      "LADDER",
      ...ladder(false)
    ])
  }
  if (want("ladder")) {
    pages.push([...identity(a, columns), "", "LADDER", ...ladder(true)])
  }
  if (want("path")) {
    pages.push([
      ...identity(a, columns),
      "",
      "PATH",
      ...plain(paintPath(a, s, l))
    ])
  }
  if (want("compare") && (b || opts.view === "compare")) {
    const { lines } = paintCompare(a, b, s, l, 100000)
    const page = plain(lines)
    if (b) {
      alignTraces(a.records, b.records)
        .filter((r) => r.state === "differs" && r.a && r.b)
        .forEach((r) => {
          page.push(
            "",
            `${opts.g.differs} A${r.a!.seq} B${r.b!.seq}  ${r.why ?? ""}`
          )
          abDiff(r.a!, r.b!).forEach((d) => {
            const glyph =
              d.kind === "changed"
                ? opts.g.changed
                : d.kind === "added"
                ? opts.g.added
                : opts.g.removed
            const text =
              d.kind === "changed"
                ? `${glyph} ${d.name}  ${d.from} ${"→"} ${d.to}`
                : `${glyph} ${d.name}  ${d.value}  ${d.by}`
            page.push(...wrap(text, columns, 4))
          })
        })
    }
    pages.push(page)
  }

  const names: StaticView[] = ["summary", "ladder", "path", "compare"]
  const separator = (name: string) =>
    `${opts.g.rule.repeat(4)} ${name} ${opts.g.rule.repeat(
      Math.max(0, columns - name.length - 6)
    )}`
  const text =
    opts.view === "all"
      ? pages.map((p, i) => [separator(names[i]), ...p].join("\n")).join("\n\n")
      : pages[0].join("\n")
  return text.replace(/[ \t]+$/gm, "") + "\n"
}
