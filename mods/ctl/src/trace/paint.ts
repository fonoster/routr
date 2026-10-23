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
import { Trace } from "@routr/common"
import { Glyphs } from "./glyphs"
import {
  abDiff,
  alignTraces,
  CallModel,
  CompareRow,
  describe,
  DiffRow,
  headerLines,
  hopChips,
  recordDiff,
  Row,
  statusCode
} from "./model"
import {
  clip,
  Color,
  elideMiddle,
  fit,
  fitAddress,
  fitCallId,
  fmtClock,
  fmtDuration,
  fmtMs,
  Line,
  rpad,
  seg,
  wrap
} from "./text"

// Views paint Line[] from the model and the UI state. The Ink app and the
// static printer both consume these lines, so what you paste from --static
// is what you saw on screen.

export const VIEWS = ["Summary", "Ladder", "Path", "Compare"] as const
export type ViewName = (typeof VIEWS)[number]

export interface Layout {
  columns: number
  rows: number
  g: Glyphs
}

export type PaneMode = "headers" | "diff" | "ab"

export interface ViewState {
  view: number
  // Index into the visible ladder/compare rows
  selected: number
  // Record index whose hops are expanded inline
  expanded?: number
  paneMode: PaneMode
  // undefined means "the default for this width"
  paneVisible?: boolean
  timeMode: 0 | 1 | 2
  overlay: boolean
  showRetrans: boolean
  filter: string
  filterInput?: string
  help: boolean
  scroll: number
  message?: string
  checkIndex: number
}

export const initialState = (view = 0): ViewState => ({
  view,
  selected: 0,
  paneMode: "headers",
  timeMode: 0,
  overlay: false,
  showRetrans: false,
  filter: "",
  help: false,
  scroll: 0,
  checkIndex: -1
})

const MIN_COLUMNS = 80
const MIN_ROWS = 20

const checkGlyph = (state: string, g: Glyphs) =>
  state === "pass"
    ? g.pass
    : state === "fail"
    ? g.fail
    : state === "warn"
    ? g.warn
    : g.na
const checkColor = (state: string): Color =>
  state === "pass"
    ? "accent"
    : state === "fail"
    ? "danger"
    : state === "warn"
    ? "warn"
    : "muted"

const padLines = (lines: Line[], rows: number): Line[] => {
  const out = lines.slice(0, rows)
  // eslint-disable-next-line no-loops/no-loops
  while (out.length < rows) out.push([])
  return out
}

const joinCols = (
  left: Line[],
  right: Line[],
  leftWidth: number,
  gap = 2
): Line[] => {
  const n = Math.max(left.length, right.length)
  return Array.from({ length: n }, (_, i) => {
    const l = left[i] || []
    const used = l.reduce((s, x) => s + x.text.length, 0)
    return [
      ...l,
      seg(" ".repeat(Math.max(0, leftWidth - used) + gap)),
      ...(right[i] || [])
    ]
  })
}

// ---------- chrome ----------

/**
 * Row 1: wordmark, file, Call-ID and verdict.
 *
 * @param {CallModel} a - File A
 * @param {CallModel} b - File B, if any
 * @param {Layout} l - Layout
 * @return {Line} The line
 */
export function statusLine(
  a: CallModel,
  b: CallModel | undefined,
  l: Layout
): Line {
  const files = b
    ? `${a.file} ${l.g.right === ">" ? ">" : "▸"} ${b.file}`
    : a.file
  const verdict = a.verdict.short
  const fixed = `${l.g.dot} routr trace  ${files}  `
  const room = l.columns - fixed.length - verdict.length - 2
  const callId = fitCallId(a.callId, Math.max(8, room), l.g)
  return [
    seg(`${l.g.dot} `, { color: "accent" }),
    seg("routr", { bold: true }),
    seg(" trace  ", { color: "muted" }),
    seg(files),
    seg("  " + callId, { color: "muted" }),
    seg("  "),
    seg(verdict, {
      color: a.verdict.word === "REJECTED" ? "danger" : "accent",
      bold: true
    })
  ]
}

/**
 * Row 2: the view bar.
 *
 * @param {ViewState} s - State
 * @param {boolean} hasCompare - Whether a second file is loaded
 * @param {Layout} l - Layout
 * @return {Line} The line
 */
export function viewBar(s: ViewState, hasCompare: boolean, l: Layout): Line {
  const line: Line = []
  VIEWS.forEach((name, i) => {
    const disabled = name === "Compare" && !hasCompare
    const label = ` ${i + 1} ${name}${
      disabled && l.columns >= 100 ? " (no file)" : ""
    } `
    line.push(
      seg(
        label,
        i === s.view
          ? { color: "accent", inverse: true, bold: true }
          : { color: disabled ? "muted" : "fg", dim: disabled }
      )
    )
    line.push(seg(" "))
  })
  return line
}

/**
 * Last row: context keys on the left, position on the right.
 *
 * @param {ViewState} s - State
 * @param {string} position - Right-aligned text
 * @param {Layout} l - Layout
 * @return {Line} The line
 */
export function statusBar(s: ViewState, position: string, l: Layout): Line {
  if (s.filterInput !== undefined) {
    return [
      seg("filter: ", { color: "muted" }),
      seg(s.filterInput),
      seg("  Enter apply  Esc clear", { color: "muted" })
    ]
  }
  if (s.message) return [seg(clip(s.message, l.columns), { color: "warn" })]
  const keys =
    s.view === 1
      ? "j/k select  Enter hops  d diff  p pane  t time  / filter  n next problem  ? help  q quit"
      : s.view === 3
      ? "j/k select  d A/B diff  n next difference  ? help  q quit"
      : s.view === 0
      ? "n next failed check  2 ladder  3 path  ? help  q quit"
      : "j/k scroll  2 ladder  ? help  q quit"
  const left = s.filter ? `filter: ${s.filter}  ${position}  Esc clear` : keys
  const room = l.columns - position.length - 2
  return [
    seg(fit(left, Math.max(0, room)), { color: "muted" }),
    seg("  "),
    seg(position, { color: "muted" })
  ]
}

/**
 * The help overlay body.
 *
 * @return {Line[]} The lines
 */
export function helpLines(): Line[] {
  const rows: [string, string][] = [
    ["1 2 3 4", "Summary, Ladder, Path, Compare"],
    ["Tab ] [ → ← l h", "next / previous view"],
    ["j k ↓ ↑", "select next / previous message"],
    ["g G", "first / last message"],
    ["Ctrl-D Ctrl-U PgDn PgUp", "half page down / up"],
    ["Enter", "expand / collapse the hops of the selected message"],
    ["d", "detail pane: headers / diff (A/B diff in Compare)"],
    ["p", "show / hide the detail pane"],
    ["t", "time column: offset / delta / clock"],
    ["c", "compare overlay on the ladder"],
    ["x", "show / collapse retransmissions"],
    ["/", "filter by method, status (5xx) or outcome"],
    ["n N", "next / previous problem"],
    ["Esc", "close, clear filter"],
    ["q Ctrl-C", "quit"]
  ]
  return [
    [seg("keys", { bold: true })],
    [],
    ...rows.map(
      ([k, v]): Line => [seg(fit(k, 26), { color: "accent" }), seg(v)]
    ),
    [],
    [seg("any key to close", { color: "muted" })]
  ]
}

/**
 * The message shown when the terminal is too small.
 *
 * @param {Layout} l - Layout
 * @return {string | undefined} The message, or undefined when the size is fine
 */
export function tooSmall(l: Layout): string | undefined {
  if (l.columns >= MIN_COLUMNS && l.rows >= MIN_ROWS) return undefined
  return `rctl trace replay needs at least ${MIN_COLUMNS}×${MIN_ROWS} (now ${l.columns}×${l.rows}); resize or use --static`
}

// ---------- summary ----------

/**
 * The Summary view.
 *
 * @param {CallModel} m - Model
 * @param {ViewState} s - State
 * @param {Layout} l - Layout
 * @return {Line[]} The lines
 */
export function paintSummary(m: CallModel, s: ViewState, l: Layout): Line[] {
  const verdictColor: Color =
    m.verdict.word === "REJECTED"
      ? "danger"
      : m.verdict.word === "FORWARDED"
      ? "accent"
      : "warn"
  const head: Line[] = [
    [
      seg(m.verdict.word, { color: verdictColor, bold: true }),
      seg(m.verdict.line.slice(m.verdict.word.length))
    ],
    []
  ]

  const checkWidth = l.columns >= 120 ? l.columns - 48 - 2 : l.columns
  const checks: Line[] = []
  m.checks.forEach((c, i) => {
    const glyph = checkGlyph(c.state, l.g)
    const indent = glyph.length + 1
    wrap(c.text, checkWidth - indent, 0).forEach((text, j) => {
      checks.push([
        seg(j === 0 ? `${glyph} ` : " ".repeat(indent), {
          color: checkColor(c.state)
        }),
        seg(text, i === s.checkIndex ? { inverse: true } : {})
      ])
    })
  })
  if (m.checksNote) checks.push([seg(m.checksNote, { color: "muted" })])

  const twoCols = l.columns >= 120
  const facts: Line[] = m.facts.map(([k, v]) => [
    seg(fit(k, 12), { color: "muted" }),
    seg(twoCols ? clip(v, 34, l.g.ellipsis) : v)
  ])

  const body = twoCols ? joinCols(facts, checks, 46) : [...checks, [], ...facts]
  const lines = [...head, ...body]
  return lines.slice(s.scroll)
}

// ---------- ladder ----------

interface LadderGeometry {
  gutter: number
  laneWidth: number
  overlayCol: number
  paneSide: "right" | "bottom" | "none"
  paneWidth: number
  paneRows: number
}

/**
 * Lays out the ladder for a width, following the per-width rules.
 *
 * @param {ViewState} s - State
 * @param {Layout} l - Layout
 * @param {number} laneCount - Lanes
 * @param {boolean} hasCompare - Whether an overlay is possible
 * @return {LadderGeometry} The geometry
 */
export function ladderGeometry(
  s: ViewState,
  l: Layout,
  laneCount: number,
  hasCompare: boolean
): LadderGeometry {
  const gutter = 9 + (l.g.pass.length > 1 ? 1 : 0)
  const overlayCol = s.overlay && hasCompare ? 3 : 0
  const paneVisible = s.paneVisible ?? l.columns >= 100
  const side: LadderGeometry["paneSide"] = !paneVisible
    ? "none"
    : l.columns >= 120
    ? "right"
    : "bottom"
  const paneWidth = side === "right" ? (l.columns >= 160 ? 56 : 44) : 0
  const paneRows =
    side === "bottom" ? (l.rows < 28 ? 6 : l.columns >= 100 ? 10 : 8) : 0
  const ladderWidth = l.columns - paneWidth - (side === "right" ? 1 : 0)
  const laneWidth = Math.max(
    16,
    Math.floor((ladderWidth - gutter - overlayCol - 1) / Math.max(2, laneCount))
  )
  return { gutter, laneWidth, overlayCol, paneSide: side, paneWidth, paneRows }
}

const arrow = (
  from: number,
  to: number,
  label: string,
  kind: "request" | "response",
  laneWidth: number,
  g: Glyphs,
  dropped = false
): string => {
  const a = Math.min(from, to)
  const b = Math.max(from, to)
  const span = laneWidth * (b - a)
  const fill = kind === "response" ? g.dashed : g.solid
  const lbl = clip(label, Math.max(0, span - 3), g.ellipsis)
  let art: string
  if (dropped) {
    art =
      fill + lbl + fill.repeat(Math.max(1, span - lbl.length - 2)) + g.dropped
  } else if (from < to) {
    art = fill + lbl + fill.repeat(Math.max(1, span - lbl.length - 2)) + g.right
  } else {
    art = g.left + fill.repeat(Math.max(1, span - lbl.length - 2)) + lbl + fill
  }
  art = art.slice(0, span).padEnd(span)
  return " ".repeat(laneWidth * a + Math.floor(laneWidth / 2)) + art
}

/** A rendered ladder line, with the row it belongs to. */
export interface LadderLine {
  line: Line
  row?: number
  ghost?: CompareRow
}

/**
 * Rows of the ladder after the filter and the retransmission fold.
 *
 * @param {CallModel} m - Model
 * @param {ViewState} s - State
 * @return {Row[]} The visible rows
 */
export function visibleRows(m: CallModel, s: ViewState): Row[] {
  const f = s.filter.trim().toLowerCase()
  const classMatch = f.match(/^([1-6])xx$/)
  return m.rows.filter((row) => {
    if (!s.showRetrans && row.retransOf !== undefined) return false
    if (!f) return true
    const r = m.records[row.index]
    const status = statusCode(r)
    if (classMatch)
      return !!status && Math.floor(status / 100) === Number(classMatch[1])
    if (/^\d{3}$/.test(f)) return status === Number(f)
    return (
      row.inLeg.label.toLowerCase().includes(f) ||
      r.outcome.includes(f) ||
      r.method.toLowerCase() === f
    )
  })
}

const timeCell = (row: Row, s: ViewState, width: number, g: Glyphs): string => {
  const text =
    s.timeMode === 0
      ? `+${fmtMs(row.tOffsetMs)}`
      : s.timeMode === 1
      ? `${g.delta}${fmtMs(row.deltaMs)}`
      : fmtClock(row.clock)
  return rpad(text, width)
}

/**
 * Paints the ladder body: lane titles, rows, optional inline hops.
 *
 * @param {CallModel} m - Model A
 * @param {CallModel | undefined} b - Model B for the overlay
 * @param {ViewState} s - State
 * @param {Layout} l - Layout
 * @param {LadderGeometry} geo - Geometry
 * @return {LadderLine[]} Lines tagged with their row
 */
export function paintLadderBody(
  m: CallModel,
  b: CallModel | undefined,
  s: ViewState,
  l: Layout,
  geo: LadderGeometry
): LadderLine[] {
  const g = l.g
  const { gutter, laneWidth, overlayCol } = geo
  const rows = visibleRows(m, s)
  const lanes = m.lanes
  const center = (t: string, w: number) => {
    const c = clip(t, w, g.ellipsis)
    const left = Math.floor((w - c.length) / 2)
    return (
      " ".repeat(Math.max(0, left)) +
      c +
      " ".repeat(Math.max(0, w - c.length - left))
    )
  }
  const out: LadderLine[] = []
  const pad = " ".repeat(gutter + overlayCol)
  out.push({
    line: [
      seg(pad),
      ...lanes.map((lane, i) =>
        seg(center(lane.title, laneWidth), {
          bold: true,
          color: i === 1 ? "accent" : "fg"
        })
      )
    ]
  })
  // Lane subtitles (addresses) need room; at 80 columns titles only
  if (laneWidth >= 27) {
    out.push({
      line: [
        seg(pad),
        ...lanes.map((lane) =>
          seg(center(fitAddress(lane.subtitle, laneWidth - 2, g), laneWidth), {
            color: "muted"
          })
        )
      ]
    })
  }

  const overlay = s.overlay && b ? alignTraces(m.records, b.records) : undefined
  const overlayState = (
    index: number
  ): { glyph: string; color: Color } | undefined => {
    if (!overlay) return undefined
    const r = overlay.find((c) => c.a === m.records[index])
    if (!r) return undefined
    return r.state === "same"
      ? { glyph: "=", color: "muted" }
      : r.state === "differs"
      ? { glyph: g.differs, color: "danger" }
      : { glyph: g.removed, color: "warn" }
  }
  const ghostsBefore = (index: number): CompareRow[] => {
    if (!overlay) return []
    const pos = overlay.findIndex((c) => c.a === m.records[index])
    const ghosts: CompareRow[] = []
    // eslint-disable-next-line no-loops/no-loops
    for (let i = pos - 1; i >= 0 && overlay[i].state === "onlyB"; i--)
      ghosts.unshift(overlay[i])
    return ghosts
  }

  rows.forEach((row, vi) => {
    const selected = vi === s.selected
    const rec = m.records[row.index]
    if (row.gapBeforeMs) {
      out.push({
        line: [
          seg(" ".repeat(gutter + overlayCol)),
          seg(`${g.gap} ${fmtDuration(row.gapBeforeMs)} ${g.gap}`, {
            color: "muted",
            dim: true
          })
        ]
      })
    }
    ghostsBefore(row.index).forEach((ghost) => {
      const label = `(B) ${describe(ghost.b!)}`
      out.push({
        ghost,
        line: [
          seg(" ".repeat(gutter)),
          seg(fit(g.added, overlayCol), { color: "info" }),
          seg(" ".repeat(laneWidth) + clip(label, laneWidth * 2, g.ellipsis), {
            color: "info",
            dim: true
          })
        ]
      })
    })
    const markGlyph =
      row.mark === "fail"
        ? g.fail
        : row.mark === "challenge"
        ? g.challenge
        : row.mark === "dropped"
        ? g.sep
        : row.mark === "retrans"
        ? "="
        : " "
    const markColor: Color =
      row.mark === "fail" ? "danger" : row.mark === "retrans" ? "muted" : "fg"
    const timeWidth = gutter - 3
    const time = timeCell(row, s, timeWidth, g)
    const sel = selected ? g.marker : " "
    const ov = overlayState(row.index)
    const ovSeg = overlayCol
      ? seg(fit(ov?.glyph ?? " ", overlayCol), { color: ov?.color ?? "muted" })
      : seg("")
    const label =
      row.inLeg.label +
      (row.retransmissions ? ` ${g.times}${row.retransmissions + 1}` : "")
    const inLine: Line = [
      seg(sel, { color: "accent" }),
      seg(fit(markGlyph, 1), { color: markColor }),
      seg(" "),
      seg(time, { color: "muted" }),
      ovSeg,
      seg(
        arrow(
          row.inLeg.from,
          row.inLeg.to,
          label,
          row.inLeg.kind,
          laneWidth,
          g,
          row.mark === "dropped"
        ),
        { color: row.inLeg.color, inverse: selected }
      )
    ]
    out.push({ row: vi, line: inLine })

    if (s.expanded === row.index) {
      const indent =
        gutter + overlayCol + laneWidth + Math.floor(laneWidth / 2) + 1
      const room = l.columns - indent - 2
      if (!rec.hops.length) {
        out.push({
          row: vi,
          line: [
            seg(" ".repeat(indent)),
            seg(`${g.last} no hops recorded`, { color: "muted" })
          ]
        })
      }
      rec.hops.forEach((h) => {
        const chips = hopChips(h, g).join(" ")
        const text = `${g.branch} ${fit(h.component, 11)} ${rpad(
          fmtDuration(h.durationMs),
          7
        )}  ${h.action}${chips ? "  " + chips : h.diff ? "  no changes" : ""}`
        out.push({
          row: vi,
          line: [
            seg(" ".repeat(indent)),
            seg(clip(text, room, g.ellipsis), { color: "muted" })
          ]
        })
        if (h.error) {
          out.push({
            row: vi,
            line: [
              seg(" ".repeat(indent + 2)),
              seg(clip(h.error, room - 2, g.ellipsis), { color: "danger" })
            ]
          })
        }
      })
      out.push({
        row: vi,
        line: [
          seg(" ".repeat(indent)),
          seg(`${g.last} ${fmtDuration(rec.totalMs)}`, { color: "muted" })
        ]
      })
    }

    if (row.outLeg) {
      const outLine: Line = [
        seg(" ".repeat(gutter + overlayCol)),
        seg(
          arrow(
            row.outLeg.from,
            row.outLeg.to,
            row.outLeg.label,
            row.outLeg.kind,
            laneWidth,
            g
          ),
          { color: row.outLeg.color, inverse: selected }
        )
      ]
      out.push({ row: vi, line: outLine })
    }
  })

  if (!rows.length) {
    out.push({
      line: [
        seg(s.filter ? `no messages match ${s.filter}` : "no messages", {
          color: "muted"
        })
      ]
    })
  }
  out.push({ line: [] })
  out.push({
    line: [
      seg(
        `${g.solid} request  ${g.dashed} response  times from the first message in ms`,
        { color: "muted" }
      )
    ]
  })
  return out
}

/**
 * Paints the detail pane for a record.
 *
 * @param {CallModel} m - Model A
 * @param {CallModel | undefined} b - Model B
 * @param {Trace.TraceRecord | undefined} rec - Selected record
 * @param {ViewState} s - State
 * @param {number} width - Pane width
 * @param {Layout} l - Layout
 * @return {Line[]} The lines
 */
export function paintPane(
  m: CallModel,
  b: CallModel | undefined,
  rec: Trace.TraceRecord | undefined,
  s: ViewState,
  width: number,
  l: Layout
): Line[] {
  const g = l.g
  if (!rec) return [[seg("select a message", { color: "muted" })]]
  const row = m.rows[m.records.indexOf(rec)]
  const title = `record ${rec.seq} ${g.sep} ${row.inLeg.label} ${g.sep} ${
    rec.outcome
  }${rec.status ? " " + rec.status : ""} ${g.sep} ${row.hopsSummary}`
  const lines: Line[] = [[seg(clip(title, width, g.ellipsis), { bold: true })]]
  const wrapTo = (text: string, color?: Color, indent = 4) =>
    wrap(text, width, indent).forEach((t) =>
      lines.push([seg(t, color ? { color } : {})])
    )

  if (s.paneMode === "headers") {
    const req = rec.request
    const lp =
      req.listeningPoints?.find((x) => x.transport === req.sender.transport) ||
      req.listeningPoints?.[0]
    wrapTo(
      rec.kind === "request"
        ? `${rec.method} ${Trace.formatUri(req.message.requestUri)}`
        : `SIP/2.0 ${rec.status ?? ""} ${row.inLeg.label.replace(/^\d+ /, "")}`
    )
    wrapTo(
      `in   ${req.sender.host}:${req.sender.port}/${
        req.sender.transport
      } ${"→"} ${lp ? `${lp.host}:${lp.port}/${lp.transport}` : "?"}`,
      "muted"
    )
    if (rec.response) {
      const via = rec.response.message.via?.[0]
      const uri = rec.response.message.requestUri
      wrapTo(
        `out  ${
          via ? `${via.host}:${via.port}/${via.transport}` : "?"
        } ${"→"} ${
          uri
            ? `${uri.host}${uri.port ? ":" + uri.port : ""}`
            : row.outLeg
            ? m.lanes[row.outLeg.to]?.subtitle ?? ""
            : ""
        }`,
        "muted"
      )
    } else {
      wrapTo("no outgoing message recorded", "warn")
    }
    lines.push([])
    headerLines(rec).forEach((h) => wrapTo(h, "muted"))
    lines.push([])
    lines.push([seg("hops", { bold: true })])
    if (!rec.hops.length)
      lines.push([seg("no hops recorded", { color: "muted" })])
    rec.hops.forEach((h) => {
      const chips = hopChips(h, g)
      const counts = h.diff
        ? `${g.added}${Object.keys(h.diff.headers.added).length} ${g.removed}${
            Object.keys(h.diff.headers.removed).length
          } ${g.changed}${
            Object.keys(h.diff.headers.changed).length +
            (h.diff.requestUri ? 1 : 0)
          }`
        : ""
      lines.push([
        seg(fit(h.component, 12), { color: "info" }),
        seg(rpad(fmtDuration(h.durationMs), 8)),
        seg(`  ${h.action}`),
        seg(chips.length ? `  ${counts}` : h.diff ? "  no changes" : "", {
          color: "muted"
        })
      ])
      if (h.error) wrapTo(h.error, "danger", 2)
    })
    return lines
  }

  const rows: DiffRow[] =
    s.paneMode === "ab" && b
      ? (() => {
          const aligned = alignTraces(m.records, b.records).find(
            (c) => c.a === rec
          )
          return aligned?.b ? abDiff(rec, aligned.b) : []
        })()
      : recordDiff(rec)
  lines.push([
    seg(
      s.paneMode === "ab"
        ? `diff  A ${"→"} B  outgoing messages`
        : `diff  ${row.inLeg.label}  in ${"→"} out  (${rec.hops.length} hops)`,
      { color: "muted" }
    )
  ])
  if (!rec.response)
    lines.push([seg("no outgoing message recorded", { color: "warn" })])
  else if (!rows.length)
    lines.push([
      seg(
        s.paneMode === "ab"
          ? "no matching record in B, or identical"
          : "no changes",
        { color: "muted" }
      )
    ])
  rows.forEach((d) => {
    const glyph =
      d.kind === "changed"
        ? g.changed
        : d.kind === "added"
        ? g.added
        : g.removed
    const color: Color =
      d.kind === "changed" ? "warn" : d.kind === "added" ? "accent" : "danger"
    const value = d.value === Trace.REDACTED ? "(redacted)" : d.value ?? ""
    const body = d.kind === "changed" ? `${d.from} ${"\u2192"} ${d.to}` : value
    const oneLine = `${glyph} ${d.name}  ${body}  ${d.by}`
    if (oneLine.length <= width) {
      lines.push([
        seg(`${glyph} `, { color }),
        seg(d.name),
        seg(`  ${body}`),
        seg(`  ${d.by}`, { color: "muted" })
      ])
      return
    }
    // Stacked: the name and the responsible hop on one line, values below,
    // wrapped at token boundaries so a host or a tag is never split
    const nameRoom = Math.max(8, width - 2 - d.by.length - 2)
    lines.push([
      seg(`${glyph} `, { color }),
      seg(fit(d.name, nameRoom)),
      seg(`  ${d.by}`, { color: "muted" })
    ])
    if (d.kind === "changed") {
      wrap(d.from ?? "", width - 4, 0).forEach((t) =>
        lines.push([seg("    " + t, { color: "muted" })])
      )
      wrap(`${"\u2192"} ${d.to}`, width - 2, 2).forEach((t) =>
        lines.push([seg("  " + t)])
      )
    } else {
      wrap(value, width - 4, 0).forEach((t) => lines.push([seg("    " + t)]))
    }
  })
  return lines
}

/**
 * The Ladder view with the pane placed per the width rules.
 *
 * @param {CallModel} m - Model A
 * @param {CallModel | undefined} b - Model B
 * @param {ViewState} s - State
 * @param {Layout} l - Layout
 * @param {number} rows - Rows available for the view
 * @return {object} Lines and the rows that were visible
 */
export function paintLadder(
  m: CallModel,
  b: CallModel | undefined,
  s: ViewState,
  l: Layout,
  rows: number
): { lines: Line[]; visible: Row[] } {
  const geo = ladderGeometry(s, l, m.lanes.length, !!b)
  const visible = visibleRows(m, s)
  const body = paintLadderBody(m, b, s, l, geo)
  const selectedRec = visible[s.selected]
    ? m.records[visible[s.selected].index]
    : undefined

  const ladderRows = geo.paneSide === "bottom" ? rows - geo.paneRows - 1 : rows
  // Keep the selection in view with two rows of margin
  const selIdx = body.findIndex((x) => x.row === s.selected)
  const selEnd =
    body.length - 1 - [...body].reverse().findIndex((x) => x.row === s.selected)
  let start = 0
  if (selIdx >= 0 && selEnd >= ladderRows - 2)
    start = Math.min(
      selEnd - ladderRows + 3,
      Math.max(0, body.length - ladderRows)
    )
  const windowed = body.slice(start, start + ladderRows).map((x) => x.line)
  const ladderLines = padLines(windowed, ladderRows)

  if (geo.paneSide === "right") {
    const ladderWidth = l.columns - geo.paneWidth - 1
    const pane = padLines(
      paintPane(m, b, selectedRec, s, geo.paneWidth - 1, l),
      rows
    )
    return {
      visible,
      lines: ladderLines.map((line, i) => {
        const used = line.reduce((n, x) => n + x.text.length, 0)
        return [
          ...line,
          seg(" ".repeat(Math.max(0, ladderWidth - used))),
          seg(l.g.pipe + " ", { color: "muted" }),
          ...(pane[i] || [])
        ]
      })
    }
  }
  if (geo.paneSide === "bottom") {
    const title = selectedRec
      ? ` record ${selectedRec.seq} ${l.g.sep} ${
          visible[s.selected].inLeg.label
        } ${l.g.sep} ${selectedRec.outcome} `
      : ""
    const rule: Line = [
      seg(
        l.g.rule.repeat(2) +
          title +
          l.g.rule.repeat(Math.max(0, l.columns - title.length - 2)),
        { color: "muted" }
      )
    ]
    const pane = padLines(
      paintPane(m, b, selectedRec, s, l.columns, l).slice(1),
      geo.paneRows
    )
    return { visible, lines: [...ladderLines, rule, ...pane] }
  }
  return { visible, lines: ladderLines }
}

// ---------- path ----------

/**
 * The Path view.
 *
 * @param {CallModel} m - Model
 * @param {ViewState} s - State
 * @param {Layout} l - Layout
 * @return {Line[]} The lines
 */
export function paintPath(m: CallModel, s: ViewState, l: Layout): Line[] {
  const g = l.g
  const p = m.pathModel
  const lines: Line[] = []
  const boxes = l.columns >= 100 && g.pipe === "│"
  if (boxes) {
    const gap = 3
    // Three boxes and two labelled arrows (gap + 16 cells each) must fit
    const w = Math.min(32, Math.floor((l.columns - 2 * (gap + 16)) / 3))
    const top = (i: number): Line => [
      seg(`╭${g.rule.repeat(w - 2)}╮`, { color: i === 1 ? "accent" : "muted" })
    ]
    const mid = (text: string, i: number, bold = false): Line => [
      seg(g.pipe, { color: i === 1 ? "accent" : "muted" }),
      seg(" " + fit(text, w - 4) + " ", {
        bold,
        color: bold && i === 1 ? "accent" : bold ? "fg" : "muted"
      }),
      seg(g.pipe, { color: i === 1 ? "accent" : "muted" })
    ]
    const bottom = (i: number): Line => [
      seg(`╰${g.rule.repeat(w - 2)}╯`, { color: i === 1 ? "accent" : "muted" })
    ]
    const height = Math.max(...p.actors.map((a) => a.lines.length)) + 1
    const labels = [
      "",
      p.requestUri ? "INVITE" : "",
      p.requestUri ? "INVITE rewritten" : ""
    ]
    const rowsOut: Line[][] = p.actors.map((a, i) => [
      top(i),
      mid(a.title, i, true),
      ...Array.from({ length: height - 1 }, (_, k) => mid(a.lines[k] ?? "", i)),
      bottom(i)
    ])
    const labelLine: Line = []
    const arrowLine: Line = []
    p.actors.forEach((_, i) => {
      labelLine.push(seg(" ".repeat(w)))
      arrowLine.push(seg(" ".repeat(w)))
      if (i < p.actors.length - 1) {
        const lbl = labels[i + 1] || ""
        labelLine.push(seg(" " + fit(lbl, gap + 14) + " "))
        arrowLine.push(seg(" " + g.solid.repeat(gap + 13) + g.right + " "))
      }
    })
    // Interleave: label row, then boxes with the arrow on the title row
    const rowCount = height + 2
    // eslint-disable-next-line no-loops/no-loops
    for (let r = 0; r < rowCount; r++) {
      const line: Line = []
      p.actors.forEach((_, i) => {
        line.push(...rowsOut[i][r])
        if (i < p.actors.length - 1) {
          if (r === 1)
            line.push(
              seg(" " + fit(labels[i + 1] || "", gap + 14) + " ", {
                color: "muted"
              })
            )
          else if (r === 2)
            line.push(seg(" " + g.solid.repeat(gap + 13) + g.right + " "))
          else line.push(seg(" ".repeat(gap + 16)))
        }
      })
      lines.push(line)
    }
  } else {
    p.actors.forEach((a, i) => {
      lines.push([
        seg(fit(a.title, 16), { bold: true, color: i === 1 ? "accent" : "fg" }),
        seg(a.lines.join("   "), { color: "muted" })
      ])
      if (i < p.actors.length - 1)
        lines.push([
          seg(
            "   " + g.pipe + "  " + (i === 0 ? "INVITE" : "INVITE rewritten"),
            { color: "muted" }
          )
        ])
    })
  }
  lines.push([])
  if (p.nothingForwarded) {
    wrap(p.nothingForwarded, l.columns, 2).forEach((t) =>
      lines.push([seg(t, { color: "danger" })])
    )
    return lines.slice(s.scroll)
  }
  lines.push([seg("REQUEST-URI", { color: "muted" })])
  if (p.requestUri) {
    const one = `${p.requestUri.from}  ${"→"}  ${p.requestUri.to}`
    if (one.length <= l.columns)
      lines.push([
        seg(p.requestUri.from),
        seg(`  ${"→"}  `, { color: "accent" }),
        seg(p.requestUri.to)
      ])
    else {
      lines.push([seg(p.requestUri.from)])
      lines.push([seg(`  ${"→"} `, { color: "accent" }), seg(p.requestUri.to)])
    }
  }
  lines.push([])
  lines.push([seg("VIA STACK, TOP FIRST", { color: "muted" })])
  p.via.forEach((v) => {
    const note = `  ${v.note}`
    const room = l.columns - note.length
    wrap(v.line, room, 4).forEach((t, i) =>
      lines.push([
        seg(t),
        ...(i === 0
          ? [
              seg(note, {
                color: v.note.startsWith("ours") ? "accent" : "muted"
              })
            ]
          : [])
      ])
    )
  })
  lines.push([])
  lines.push([seg("ROUTE SET", { color: "muted" })])
  lines.push([
    seg("Route: ", { color: "muted" }),
    seg(`${p.routeIn}, ${p.routeOut}`)
  ])
  lines.push([
    seg("Record-Route: ", { color: "muted" }),
    seg(p.recordRoute ? `${g.added} ${p.recordRoute}` : "none", {
      color: p.recordRoute ? "accent" : "fg"
    })
  ])
  lines.push([])
  p.notes.forEach((n) => {
    const glyph =
      n.color === "accent" ? g.pass : n.color === "warn" ? g.warn : g.fail
    wrap(n.text, l.columns - glyph.length - 1, 0).forEach((t, i) =>
      lines.push([
        seg(i === 0 ? `${glyph} ` : " ".repeat(glyph.length + 1), {
          color: n.color
        }),
        seg(t)
      ])
    )
  })
  return lines.slice(s.scroll)
}

// ---------- compare ----------

/**
 * The Compare view.
 *
 * @param {CallModel} a - Model A
 * @param {CallModel | undefined} b - Model B
 * @param {ViewState} s - State
 * @param {Layout} l - Layout
 * @param {number} rows - Rows available
 * @return {object} Lines and the aligned rows
 */
export function paintCompare(
  a: CallModel,
  b: CallModel | undefined,
  s: ViewState,
  l: Layout,
  rows: number
): { lines: Line[]; aligned: CompareRow[] } {
  const g = l.g
  if (!b) {
    return {
      aligned: [],
      lines: wrap(
        "No second file. Run rctl trace replay <a.jsonl> --compare <b.jsonl> to line up two recordings of the same scenario.",
        l.columns,
        0
      ).map((t) => [seg(t, { color: "muted" })])
    }
  }
  const aligned = alignTraces(a.records, b.records)
  const head = (m: CallModel, tag: string): Line => [
    seg(`${tag}  `, { color: tag === "B" ? "info" : "accent", bold: true }),
    seg(fit(m.file, Math.max(a.file.length, b.file.length) + 2)),
    seg(
      `${m.recordedAt.slice(0, 10)}  routr ${
        m.records[0].edgePort.version ?? "?"
      }  ${m.verdict.word.toLowerCase()}  ${m.records.length} messages`,
      { color: "muted" }
    )
  ]
  const differs = aligned.filter((r) => r.state === "differs").length
  const onlyA = aligned.filter((r) => r.state === "onlyA").length
  const onlyB = aligned.filter((r) => r.state === "onlyB").length
  const problems = differs + onlyA + onlyB
  const verdict: Line = problems
    ? [
        seg(
          `${g.differs} ${differs} of ${aligned.length} rows differ ${g.sep} ${onlyA} only in A ${g.sep} ${onlyB} only in B`,
          { color: "warn" }
        )
      ]
    : [seg(`${g.pass} all ${aligned.length} rows agree`, { color: "accent" })]
  if (a.callId !== b.callId)
    verdict.push(
      seg(`   different calls: A ${a.callId}  B ${b.callId}`, {
        color: "muted"
      })
    )
  const lines: Line[] = [head(a, "A"), head(b, "B"), verdict, []]

  const wide = l.columns >= 120
  const gutterW = 12
  const colW = wide
    ? Math.floor((l.columns - gutterW - 2) / 2)
    : l.columns - gutterW
  const cell = (r: Trace.TraceRecord | undefined, missing: string) =>
    r ? describe(r) : missing
  const stateGlyph = (st: CompareRow["state"]) =>
    st === "same"
      ? " "
      : st === "differs"
      ? g.differs
      : st === "onlyA"
      ? g.removed
      : g.added
  const stateColor = (st: CompareRow["state"]): Color =>
    st === "same"
      ? "fg"
      : st === "differs"
      ? "danger"
      : st === "onlyA"
      ? "warn"
      : "info"
  const body: Line[] = []
  const rowStart: number[] = []
  aligned.forEach((r, i) => {
    rowStart.push(body.length)
    const sel = i === s.selected
    const seqs = `A${r.a ? r.a.seq : "–"} B${r.b ? r.b.seq : "–"}`
    const gutterSeg = [
      seg(sel ? g.marker : " ", { color: "accent" }),
      seg(fit(stateGlyph(r.state), 2), { color: stateColor(r.state) }),
      seg(fit(seqs, gutterW - 3), { color: "muted" })
    ]
    if (wide) {
      body.push([
        ...gutterSeg,
        seg(fit(cell(r.a, "not in A"), colW), {
          color: r.a ? stateColor(r.state) : "muted",
          inverse: sel
        }),
        seg("  "),
        seg(fit(cell(r.b, "not in B"), colW), {
          color: r.b ? stateColor(r.state) : "muted",
          inverse: sel
        })
      ])
      if (l.columns >= 160 && r.state === "differs" && r.why)
        body.push([
          seg(" ".repeat(gutterW)),
          seg(`  ${r.why}`, { color: "warn" })
        ])
    } else {
      body.push([
        ...gutterSeg,
        seg(fit("A " + cell(r.a, "not in A"), colW), {
          color: r.a ? stateColor(r.state) : "muted",
          inverse: sel
        })
      ])
      body.push([
        seg(" ".repeat(gutterW)),
        seg(fit("B " + cell(r.b, "not in B"), colW), {
          color: r.b ? stateColor(r.state) : "muted",
          inverse: sel
        })
      ])
    }
  })
  const avail = rows - lines.length
  const selStart = rowStart[s.selected] ?? 0
  let start = 0
  if (selStart + 2 >= avail)
    start = Math.min(selStart - avail + 4, Math.max(0, body.length - avail))
  return { aligned, lines: [...lines, ...body.slice(start, start + avail)] }
}

/**
 * Paints the whole screen for the interactive app.
 *
 * @param {CallModel} a - Model A
 * @param {CallModel | undefined} b - Model B
 * @param {ViewState} s - State
 * @param {Layout} l - Layout
 * @return {Line[]} Exactly l.rows lines
 */
export function paintScreen(
  a: CallModel,
  b: CallModel | undefined,
  s: ViewState,
  l: Layout
): Line[] {
  const small = tooSmall(l)
  if (small) return padLines([[seg(small, { color: "warn" })]], l.rows)
  const bodyRows = l.rows - 3
  let body: Line[]
  let position = ""
  if (s.help) {
    body = helpLines()
  } else if (s.view === 0) {
    body = paintSummary(a, s, l)
  } else if (s.view === 1) {
    const { lines, visible } = paintLadder(a, b, s, l, bodyRows)
    body = lines
    const row = visible[s.selected]
    position = row
      ? `msg ${s.selected + 1}/${visible.length}  +${fmtMs(row.tOffsetMs)} ms`
      : ""
  } else if (s.view === 2) {
    body = paintPath(a, s, l)
  } else {
    const { lines, aligned } = paintCompare(a, b, s, l, bodyRows)
    body = lines
    const row = aligned[s.selected]
    position = row
      ? `row ${s.selected + 1}/${aligned.length}  ${
          row.state === "same" ? "=" : l.g.differs
        }`
      : ""
  }
  return [
    statusLine(a, b, l),
    viewBar(s, !!b, l),
    ...padLines(body, bodyRows),
    statusBar(s, position, l)
  ].map((line) => trimLine(line, l.columns))
}

const trimLine = (line: Line, columns: number): Line => {
  let used = 0
  const out: Line = []
  line.some((x) => {
    if (used >= columns) return true
    const room = columns - used
    const text = x.text.length > room ? x.text.slice(0, room) : x.text
    out.push({ ...x, text })
    used += text.length
    return false
  })
  return out
}

/**
 * Re-exported so the app and the static printer share one notion of
 * "lines of a window".
 */
export const elide = elideMiddle
