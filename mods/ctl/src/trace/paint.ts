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
  elidePair,
  fitCallId,
  fit,
  fitAddress,
  fitLabel,
  fmtClock,
  fmtDuration,
  fmtMs,
  fmtMsCompact,
  Line,
  rpad,
  seg,
  Segment,
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
  // No colour or attributes (static mode, NO_COLOR, TERM=dumb): the active
  // tab is bracketed and nothing relies on a background
  plain?: boolean
}

export type Breakpoint = "narrow" | "medium" | "wide" | "ultra"

/**
 * The width class every per-width rule reads, so each rule has one source.
 *
 * @param {number} columns - Terminal width
 * @return {Breakpoint} narrow 80-99, medium 100-119, wide 120-159, ultra 160+
 */
export const breakpointOf = (columns: number): Breakpoint =>
  columns >= 160
    ? "ultra"
    : columns >= 120
    ? "wide"
    : columns >= 100
    ? "medium"
    : "narrow"

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
// Eight rows of chrome (header, tabs, status) leave 16 for the body at 80x24
const MIN_ROWS = 23

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
    ? "success"
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

// ---------- chrome ----------

const verdictColor = (word: string): Color =>
  word === "FORWARDED" ? "success" : word === "REJECTED" ? "danger" : "warn"

// The "r." of the Routr logo on a cell grid: the stem two cells wide, the
// arm across the top, the dot two cells wide (a square, cells are 1:2).
// "#" is the letter, "o" the dot. Painted as background colour, so the
// mark is solid in every terminal.
const MARK = ["####   ", "##     ", "##   oo"]
// ASCII and plain terminals get the name instead
const MARK_WIDTH = 7

/**
 * The r. mark, three rows.
 *
 * @param {Layout} l - Layout (ASCII glyphs and plain output get the name)
 * @param {boolean} dotOn - Whether the dot is lit (the splash blinks it)
 * @return {Line[]} Three rows
 */
export function wordmark(l: Layout, dotOn = true): Line[] {
  if (l.g.right === ">" || l.plain)
    return [
      [seg("routr", { bold: true }), seg(".", { color: "accent", bold: true })],
      [],
      []
    ]
  return MARK.map((row) =>
    (row.match(/#+|o+| +/g) ?? []).map((run) =>
      run[0] === "#"
        ? seg(" ".repeat(run.length), { bg: "mark" })
        : run[0] === "o" && dotOn
        ? seg(" ".repeat(run.length), { bg: "dot" })
        : seg(" ".repeat(run.length))
    )
  )
}

/**
 * Splash: the r. mark centred, the dot on or off, the file being read below.
 *
 * @param {string} file - The file being loaded
 * @param {boolean} dotOn - Blink state
 * @param {Layout} l - Layout
 * @return {Line[]} Exactly l.rows lines
 */
export function paintSplash(file: string, dotOn: boolean, l: Layout): Line[] {
  const x = Math.max(0, Math.floor((l.columns - MARK_WIDTH) / 2))
  const note = elideMiddle(`reading ${file}`, l.columns, l.g.ellipsis)
  const nx = Math.max(0, Math.floor((l.columns - note.length) / 2))
  const top = Math.max(0, Math.floor((l.rows - 5) / 2))
  return padLines(
    [
      ...Array.from({ length: top }, (): Line => []),
      ...wordmark(l, dotOn).map((m): Line => [seg(" ".repeat(x)), ...m]),
      [],
      [seg(" ".repeat(nx)), seg(note, { color: "muted" })]
    ],
    l.rows
  )
}

/**
 * The header: the r. mark on the left and one context line beside each of
 * its rows (trace files with the verdict pinned right, the call, the
 * EdgePort and dispatcher that recorded it).
 *
 * @param {CallModel} a - File A
 * @param {CallModel | undefined} b - File B, if any
 * @param {Layout} l - Layout
 * @return {Line[]} Three lines
 */
export function header(
  a: CallModel,
  b: CallModel | undefined,
  l: Layout
): Line[] {
  const g = l.g
  const left = MARK_WIDTH + 3
  const pad = (line: Line): Line => {
    const used = line.reduce((n, x) => n + x.text.length, 0)
    return [...line, seg(" ".repeat(Math.max(2, left - used)))]
  }
  const label = (t: string) => seg(fit(t, 10), { color: "muted" })
  const sep = ` ${g.right === ">" ? ">" : "\u25b8"} `
  const verdict = a.verdict.short
  const room = l.columns - left - 10
  // Two files share the room: each is shortened on its own so the
  // separator and both distinguishing tails stay visible
  const fileRoom = Math.max(16, room - verdict.length - 2)
  const files = !b
    ? elideMiddle(a.file, fileRoom, g.ellipsis)
    : a.file.length + sep.length + b.file.length <= fileRoom
    ? `${a.file}${sep}${b.file}`
    : elidePair(
        a.file,
        b.file,
        Math.floor((fileRoom - sep.length) / 2),
        g.ellipsis
      ).join(sep)
  const first = a.records[0]
  const recorded = a.recordedAt
    .replace("T", " ")
    .replace(/:\d\d(\.\d+)?Z$/, " UTC")
  const mark = wordmark(l)
  return [
    [
      ...pad(mark[0]),
      label("trace"),
      seg(files),
      seg(" ".repeat(Math.max(2, room - files.length - verdict.length))),
      seg(verdict, { color: verdictColor(a.verdict.word), bold: true })
    ],
    [
      ...pad(mark[1]),
      label("call"),
      // A long Call-ID gives way before the recording time does
      seg(
        fitCallId(
          a.callId,
          Math.max(12, room - `   recorded ${recorded}`.length),
          g
        )
      ),
      seg(`   recorded ${recorded}`, { color: "muted" })
    ],
    [
      ...pad(mark[2]),
      label("edgeport"),
      seg(`${first.edgePort.ref} ${first.edgePort.version ?? ""}`.trim()),
      seg(
        `   dispatcher ${first.dispatcher.version ?? ""}   ${
          a.records.length
        } messages`,
        { color: "muted" }
      )
    ]
  ]
}

/**
 * The view bar under the header.
 *
 * @param {ViewState} s - State
 * @param {boolean} hasCompare - Whether a second file is loaded
 * @param {Layout} l - Layout
 * @return {Line} The line
 */
export function viewBar(s: ViewState, hasCompare: boolean, l: Layout): Line {
  return VIEWS.flatMap((name, i): Line => {
    const disabled = name === "Compare" && !hasCompare
    const label = `${i + 1} ${name}${
      disabled && l.columns >= 100 ? " (no file)" : ""
    }`
    const active = i === s.view
    const text = active && l.plain ? `[${label}]` : ` ${label} `
    return [
      seg(
        text,
        active
          ? l.plain
            ? { bold: true }
            : { bg: "accent", bold: true }
          : { color: disabled ? "muted" : "fg" }
      ),
      seg("  ")
    ]
  })
}

// Key hints per view, most useful first; dropped from the right, never clipped
const KEYS: Record<number, string[]> = {
  0: ["n next failed check", "2 ladder", "3 path", "? help", "q quit"],
  1: [
    "j/k select",
    "Enter hops",
    "d diff",
    "p pane",
    "t time",
    "/ filter",
    "n next problem",
    "? help",
    "q quit"
  ],
  2: ["j/k scroll", "2 ladder", "? help", "q quit"],
  3: ["j/k select", "d A/B diff", "n next difference", "? help", "q quit"]
}

const hintList = (hints: string[], room: number): string => {
  const out: string[] = []
  hints.forEach((h) => {
    const next = [...out, h].join("  ")
    if (next.length <= room) out.push(h)
  })
  return out.join("  ")
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
  const room = l.columns - position.length - 2
  const left = s.filter
    ? fit(`filter: ${s.filter}  ${position}  Esc clear`, Math.max(0, room))
    : hintList(KEYS[s.view] ?? KEYS[2], Math.max(0, room))
  return [
    seg(left, { color: "muted" }),
    seg(" ".repeat(Math.max(0, room - left.length) + 2)),
    seg(position, { color: "muted" })
  ]
}

/**
 * The help overlay body. When the screen is too short for the full page
 * (80x24 and smaller) the title and spacing go and the legend and the
 * close hint share one line, so every key stays on screen.
 *
 * @param {number} room - Body rows available
 * @return {Line[]} The lines
 */
export function helpLines(room = Infinity): Line[] {
  const rows: [string, string][] = [
    ["1 2 3 4", "Summary, Ladder, Path, Compare"],
    ["Tab ] [ \u2192 \u2190 l h", "next / previous view"],
    ["j k \u2193 \u2191", "select next / previous message"],
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
  const keys = rows.map(
    ([k, v]): Line => [seg(fit(k, 26), { color: "accent" }), seg(v)]
  )
  if (room < keys.length + 5)
    return [
      ...keys,
      [
        seg(
          "\u2500 request \u00b7 \u254c response \u00b7 ms from the first message \u00b7 any key closes",
          { color: "muted" }
        )
      ]
    ]
  return [
    [seg("keys", { bold: true })],
    [],
    ...keys,
    [],
    [
      seg(
        "\u2500 request \u00b7 \u254c response \u00b7 times from the first message in ms",
        { color: "muted" }
      )
    ],
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
  const g = l.g
  const lines: Line[] = [
    [
      seg(m.verdict.word, { color: verdictColor(m.verdict.word), bold: true }),
      seg(m.verdict.line.slice(m.verdict.word.length))
    ],
    [],
    [seg("FACTS", { color: "muted" })]
  ]
  m.facts.forEach(([k, v]) => {
    wrap(v, Math.max(20, l.columns - 12), 12).forEach((t, i) =>
      lines.push(
        i === 0 ? [seg(fit(k, 12), { color: "muted" }), seg(t)] : [seg(t)]
      )
    )
  })
  lines.push([])
  const na = m.checks.length > 0 && m.checks.every((c) => c.state === "na")
  const coverage = na
    ? "no INVITE was forwarded"
    : `first forwarded INVITE${
        m.forwardedInvites > 1
          ? ` ${g.sep} ${m.forwardedInvites - 1} more INVITE${
              m.forwardedInvites - 1 === 1 ? "" : "s"
            } in this call`
          : ""
      }`
  lines.push([seg("CHECKS  " + coverage, { color: "muted" })])
  // Marker column, glyph column, space, text; the glyph alone carries the colour
  const glyphWidth = Math.max(
    g.pass.length,
    g.fail.length,
    g.warn.length,
    g.na.length
  )
  const indent = 1 + glyphWidth + 1
  m.checks.forEach((c, i) => {
    const highlighted = i === s.checkIndex
    const style = highlighted ? { bg: "selection" as const, bold: true } : {}
    wrap(c.text, Math.max(20, l.columns - indent), 0).forEach((text, j) => {
      lines.push(
        j === 0
          ? [
              seg(highlighted ? g.marker : " ", { color: "accent", ...style }),
              seg(fit(checkGlyph(c.state, g), glyphWidth), {
                color: checkColor(c.state),
                ...style
              }),
              seg(" " + text, style)
            ]
          : [seg(" ".repeat(indent) + text, style)]
      )
    })
  })
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
  // Cells the ladder may paint (columns minus the right pane)
  ladderWidth: number
  // Cell index of each lane's rail
  rails: number[]
}

const MIN_LANE = 21

/**
 * Lays out the ladder for a width. The gutter is marker, mark, space and
 * the time cell (8 cells, 12 in clock mode). The right pane is allowed only
 * while every lane keeps MIN_LANE cells; otherwise it moves to the bottom.
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
  const bp = breakpointOf(l.columns)
  const timeWidth = s.timeMode === 2 ? 12 : 6
  const gutter = 2 + timeWidth + 1
  const overlayCol = s.overlay && hasCompare ? 3 : 0
  const paneVisible = s.paneVisible ?? bp !== "narrow"
  const lanes = Math.max(2, laneCount)
  const laneFor = (ladderWidth: number) =>
    Math.floor((ladderWidth - gutter - overlayCol) / lanes)

  let side: LadderGeometry["paneSide"] = !paneVisible
    ? "none"
    : bp === "wide" || bp === "ultra"
    ? "right"
    : "bottom"
  let paneWidth = side === "right" ? (bp === "ultra" ? 56 : 44) : 0
  if (side === "right" && laneFor(l.columns - paneWidth - 1) < MIN_LANE) {
    side = "bottom"
    paneWidth = 0
  }
  const paneRows =
    side === "bottom" ? (l.rows < 28 ? 6 : bp === "narrow" ? 8 : 10) : 0
  const ladderWidth = side === "right" ? l.columns - paneWidth - 1 : l.columns
  const laneWidth = Math.max(16, laneFor(ladderWidth))
  // First rail right after the time column; the others share what is left
  const first = gutter + overlayCol + 1
  // Ten cells of right margin keep the last lane's title inside the ladder
  const step = Math.floor((ladderWidth - first - 10) / (lanes - 1))
  const rails = Array.from({ length: lanes }, (_, i) => first + i * step)
  return {
    gutter,
    laneWidth,
    overlayCol,
    paneSide: side,
    paneWidth,
    paneRows,
    ladderWidth,
    rails
  }
}

/**
 * The label tiers of a leg, longest first: `INVITE c2 · 2 hops 6.4ms`,
 * `INVITE c2 · 6.4ms`, `INVITE c2`. A `×N` suffix lives in the first part
 * and survives every tier.
 *
 * @param {string} label - The leg label as the model built it
 * @return {string[]} The tiers
 */
export function labelTiers(label: string): string[] {
  const parts = label.split(" · ")
  if (parts.length < 2) return [label]
  const timing = parts[parts.length - 1].replace(/^\d+ hops? /, "")
  const tiers = [label, `${parts[0]} · ${timing}`, parts[0]]
  return tiers.filter((t, i) => tiers.indexOf(t) === i)
}

/**
 * A row of cells the ladder paints into: rails first, arrows and text over
 * them, so a rail shows wherever nothing covers it.
 */
class Canvas {
  readonly cells: { ch: string; style: Partial<Segment> }[]

  /**
   * @param {number} width - Cells
   * @param {number[]} rails - Rail cell indexes to pre-draw
   * @param {Glyphs} g - Glyph set
   */
  constructor(width: number, rails: number[], g: Glyphs) {
    this.cells = Array.from({ length: width }, () => ({ ch: " ", style: {} }))
    rails.forEach((x) => this.put(x, g.pipe, { color: "muted", dim: true }))
  }

  /**
   * Writes text at a cell, clipped to the canvas.
   *
   * @param {number} x - Start cell
   * @param {string} text - Text
   * @param {Partial<Segment>} style - Style
   */
  put(x: number, text: string, style: Partial<Segment> = {}): void {
    Array.from(text).forEach((ch, i) => {
      const at = x + i
      if (at >= 0 && at < this.cells.length) this.cells[at] = { ch, style }
    })
  }

  /**
   * Applies a style over a span without changing the glyphs.
   *
   * @param {number} from - First cell
   * @param {number} to - Last cell, exclusive
   * @param {Partial<Segment>} style - Style to merge
   */
  wash(from: number, to: number, style: Partial<Segment>): void {
    // eslint-disable-next-line no-loops/no-loops
    for (let i = Math.max(0, from); i < Math.min(to, this.cells.length); i++) {
      this.cells[i] = {
        ...this.cells[i],
        style: { ...this.cells[i].style, ...style }
      }
    }
  }

  /**
   * Collapses the cells into segments, merging equal neighbours.
   *
   * @return {Line} The line
   */
  toLine(): Line {
    const line: Line = []
    this.cells.forEach((c) => {
      const last = line[line.length - 1]
      if (last && sameStyle(last, c.style)) {
        last.text += c.ch
      } else {
        line.push(seg(c.ch, c.style))
      }
    })
    // Trailing blanks carry no information
    // eslint-disable-next-line no-loops/no-loops
    while (
      line.length &&
      line[line.length - 1].text.trim() === "" &&
      !line[line.length - 1].bg
    )
      line.pop()
    return line
  }
}

const sameStyle = (a: Segment, b: Partial<Segment>) =>
  a.color === b.color &&
  !!a.bold === !!b.bold &&
  a.bg === b.bg &&
  !!a.dim === !!b.dim

/**
 * Draws one arrow on the canvas, from rail to rail, with the label at the
 * sender's end and the head on the destination rail.
 *
 * @param {Canvas} c - Row canvas
 * @param {LadderGeometry} geo - Geometry
 * @param {object} leg - From/to lanes, label and kind
 * @param {Glyphs} g - Glyph set
 * @param {Partial<Segment>} style - Colour of the arrow
 * @param {boolean} dropped - Draw the dropped head instead of an arrowhead
 */
function drawArrow(
  c: Canvas,
  geo: LadderGeometry,
  leg: {
    from: number
    to: number
    label: string
    kind: "request" | "response"
  },
  g: Glyphs,
  style: Partial<Segment>,
  dropped = false
): void {
  const lo = Math.min(leg.from, leg.to)
  const hi = Math.max(leg.from, leg.to)
  const span = geo.rails[hi] - geo.rails[lo]
  const fill = leg.kind === "response" ? g.dashed : g.solid
  const label = fitLabel(labelTiers(leg.label), Math.max(0, span - 3), g)
  const pad = Math.max(1, span - label.length - 2)
  let art: string
  let x: number
  if (leg.from <= leg.to) {
    art = fill + label + fill.repeat(pad) + (dropped ? g.dropped : g.right)
    x = geo.rails[lo] + 1
  } else {
    // A dropped leg ends in the dropped head whichever way it travels
    art = (dropped ? g.droppedLeft : g.left) + fill.repeat(pad) + label + fill
    x = geo.rails[lo]
  }
  c.put(x, art.slice(0, span).padEnd(span, fill), style)
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
      ? `+${fmtMsCompact(row.tOffsetMs)}`
      : s.timeMode === 1
      ? `${g.delta}${fmtMsCompact(row.deltaMs)}`
      : fmtClock(row.clock)
  return rpad(text.length > width ? text.slice(0, width) : text, width)
}

/**
 * Fits a lane subtitle: each address loses its transport first, then the
 * `in`/`out` words go, then only the outbound address stays.
 *
 * @param {string} subtitle - e.g. `in 10.111.221.2:5060/UDP · out 10.111.220.2:5060/UDP`
 * @param {number} n - Cells
 * @param {Glyphs} g - Glyph set
 * @return {string} The longest form that fits, else the last one clipped
 */
export function fitSubtitle(subtitle: string, n: number, g: Glyphs): string {
  const parts = subtitle.split(` ${g.sep} `)
  const bare = (p: string) => p.replace(/^(in|out) /, "")
  const addr = (p: string) =>
    fitAddress(bare(p), 1000, g).replace(/\/[A-Z]+$/, "")
  const forms = [
    subtitle,
    parts.map((p) => p.replace(bare(p), addr(p))).join(` ${g.sep} `),
    parts.map(addr).join(` ${g.sep} `),
    parts.length > 1
      ? parts[parts.length - 1].replace(
          bare(parts[parts.length - 1]),
          addr(parts[parts.length - 1])
        )
      : addr(parts[0]),
    addr(parts[parts.length - 1])
  ]
  return fitLabel(
    forms.filter((f, i) => forms.indexOf(f) === i),
    n,
    g
  )
}

const center = (t: string, w: number, g: Glyphs) => {
  const c = clip(t, w, g.ellipsis)
  const left = Math.floor((w - c.length) / 2)
  return " ".repeat(Math.max(0, left)) + c
}

/**
 * Paints the ladder body: lane titles, a rail-only row, then the records
 * with their rails, arrows and optional inline hops.
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
  const { gutter, laneWidth, overlayCol, rails, ladderWidth } = geo
  const rows = visibleRows(m, s)
  const lanes = m.lanes
  const out: LadderLine[] = []
  const laneStart = (i: number) =>
    Math.max(0, rails[i] - Math.floor(laneWidth / 2))

  // Lane header: titles, subtitles when there is room, then a rail-only row
  const titles = new Canvas(ladderWidth, [], g)
  lanes.forEach((lane, i) =>
    titles.put(laneStart(i), center(lane.title, laneWidth, g), {
      bold: true,
      color: i === 1 ? "accent" : "fg"
    })
  )
  out.push({ line: titles.toLine() })
  if (laneWidth >= 24) {
    const subs = new Canvas(ladderWidth, [], g)
    lanes.forEach((lane, i) =>
      subs.put(
        laneStart(i),
        center(fitSubtitle(lane.subtitle, laneWidth - 2, g), laneWidth, g),
        { color: "muted" }
      )
    )
    out.push({ line: subs.toLine() })
  }
  out.push({ line: new Canvas(ladderWidth, rails, g).toLine() })

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
  const selection = { bg: "selection" as const, bold: true }

  rows.forEach((row, vi) => {
    const selected = vi === s.selected
    const rec = m.records[row.index]
    if (row.gapBeforeMs) {
      const c = new Canvas(ladderWidth, [], g)
      const text = `${g.gap} ${fmtDuration(row.gapBeforeMs)} ${g.gap}`
      const span = rails[rails.length - 1] - rails[0]
      c.put(
        rails[0] + Math.max(0, Math.floor((span - text.length) / 2)),
        text,
        {
          color: "muted",
          dim: true
        }
      )
      out.push({ line: c.toLine() })
    }
    ghostsBefore(row.index).forEach((ghost) => {
      const c = new Canvas(ladderWidth, rails, g)
      c.put(gutter, fit(g.added, overlayCol), { color: "info" })
      c.put(
        rails[0] + 1,
        clip(
          `(B) ${describe(ghost.b!)}`,
          ladderWidth - rails[0] - 2,
          g.ellipsis
        ),
        { color: "info", dim: true }
      )
      out.push({ ghost, line: c.toLine() })
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
    const label =
      row.inLeg.label +
      (row.retransmissions ? ` ${g.times}${row.retransmissions + 1}` : "")

    const inRow = new Canvas(ladderWidth, rails, g)
    inRow.put(0, selected ? g.marker : " ", { color: "accent" })
    inRow.put(1, markGlyph, { color: markColor })
    inRow.put(2, timeCell(row, s, gutter - 3, g), { color: "muted" })
    const ov = overlayState(row.index)
    if (overlayCol)
      inRow.put(gutter, fit(ov?.glyph ?? " ", overlayCol), {
        color: ov?.color ?? "muted"
      })
    drawArrow(
      inRow,
      geo,
      { ...row.inLeg, label },
      g,
      { color: row.inLeg.color },
      row.mark === "dropped"
    )
    if (selected) inRow.wash(0, ladderWidth, selection)
    out.push({ row: vi, line: inRow.toLine() })

    if (s.expanded === row.index) {
      // Hops hang off Routr's rail; on a two-lane call that rail is the last
      // one and the space after it is too narrow, so they sit in the gap
      // between the two rails instead
      const tight = ladderWidth - rails[1] - 2 < 24 && rails.length === 2
      const x = tight ? rails[0] + 2 : rails[1]
      const room = tight ? rails[1] - x - 1 : ladderWidth - x - 2
      const hopLine = (glyph: string, text: string, color: Color = "muted") => {
        const c = new Canvas(ladderWidth, rails, g)
        c.put(x, glyph, { color: "muted" })
        c.put(
          x + glyph.length + 1,
          clip(text, room - glyph.length, g.ellipsis),
          { color }
        )
        return c.toLine()
      }
      if (!rec.hops.length)
        out.push({ row: vi, line: hopLine(g.last, "no hops recorded") })
      // One tier for every hop of the record, the fullest that fits them all
      const tiersOf = (h: Trace.TraceHop): string[] => {
        const counts = h.diff
          ? `${g.added}${Object.keys(h.diff.headers.added).length} ${
              g.removed
            }${Object.keys(h.diff.headers.removed).length} ${g.changed}${
              Object.keys(h.diff.headers.changed).length +
              (h.diff.requestUri ? 1 : 0)
            }`
          : ""
        const dur = rpad(fmtDuration(h.durationMs), 6)
        return [
          `${fit(h.component, 18, g.ellipsis)}  ${dur}  ${h.action}${
            counts ? "  " + counts : ""
          }`,
          `${fit(h.component, 18, g.ellipsis)}  ${dur}  ${h.action}`,
          `${h.component}  ${h.action}`,
          `${fit(h.component, 12, g.ellipsis)}  ${h.action}`
        ]
      }
      const hopRoom = room - g.branch.length
      const all = rec.hops.map(tiersOf)
      const tier =
        [0, 1, 2, 3].find((i) => all.every((t) => t[i].length <= hopRoom)) ?? 3
      rec.hops.forEach((h, k) => {
        out.push({ row: vi, line: hopLine(g.branch, all[k][tier]) })
        if (h.error)
          out.push({
            row: vi,
            line: hopLine(" ".repeat(g.branch.length), h.error, "danger")
          })
      })
      out.push({ row: vi, line: hopLine(g.last, fmtDuration(rec.totalMs)) })
    }

    if (row.outLeg) {
      const outRow = new Canvas(ladderWidth, rails, g)
      drawArrow(outRow, geo, row.outLeg, g, { color: row.outLeg.color })
      if (selected) outRow.wash(0, ladderWidth, selection)
      out.push({ row: vi, line: outRow.toLine() })
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
  const title = `record ${rec.seq} ${g.sep} ${row.inLeg.label}`
  const detail = `${rec.outcome}${rec.status ? " " + rec.status : ""} ${
    g.sep
  } ${row.hopsSummary}`
  const lines: Line[] =
    width >= 55
      ? [
          [
            seg(clip(title, width, g.ellipsis), { bold: true }),
            seg(clip(` ${g.sep} ${detail}`, width - title.length, g.ellipsis), {
              color: "muted"
            })
          ]
        ]
      : [
          [seg(clip(title, width, g.ellipsis), { bold: true })],
          [seg(clip(detail, width, g.ellipsis), { color: "muted" })]
        ]
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
    // Transports are dropped before a line wraps
    const hop = (label: string, from: string, to: string, transport: string) =>
      wrapTo(
        `${label}  ${from}/${transport} ${"→"} ${to}`.length <= width
          ? `${label}  ${from}/${transport} ${"→"} ${to}`
          : `${label}  ${from} ${"→"} ${to}`,
        "muted",
        5
      )
    hop(
      "in ",
      `${req.sender.host}:${req.sender.port}`,
      lp ? `${lp.host}:${lp.port}` : "?",
      req.sender.transport
    )
    if (
      rec.response &&
      rec.kind === "request" &&
      !rec.response.message.requestUri
    ) {
      // Routr answered the request itself (a challenge, a rejection): the
      // reply goes back to the sender, there is no outbound leg to show
      wrapTo(
        `out  ${rec.status ?? "reply"} back to ${req.sender.host}:${
          req.sender.port
        }/${req.sender.transport}`,
        "muted",
        5
      )
    } else if (rec.response) {
      const via = rec.response.message.via?.[0]
      const uri = rec.response.message.requestUri
      hop(
        "out",
        via ? `${via.host}:${via.port}` : "?",
        uri
          ? `${uri.host}${uri.port ? ":" + uri.port : ""}`
          : row.outLeg
          ? m.lanes[row.outLeg.to]?.subtitle ?? ""
          : "",
        via?.transport ?? ""
      )
    } else {
      wrapTo("no outgoing message recorded", "warn")
    }
    lines.push([])
    headerLines(rec).forEach((h) => wrapTo(h, "muted"))
    lines.push([])
    lines.push([seg("HOPS", { color: "muted" })])
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
        seg(rpad(fmtDuration(h.durationMs), 6)),
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
      d.kind === "changed" ? "warn" : d.kind === "added" ? "success" : "danger"
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
          seg(" ".repeat(Math.max(0, geo.ladderWidth - used))),
          seg(l.g.pipe, { color: "muted", dim: true }),
          seg(" "),
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
      seg(l.g.rule.repeat(2), { color: "muted", dim: true }),
      seg(title),
      seg(l.g.rule.repeat(Math.max(0, l.columns - title.length - 2)), {
        color: "muted",
        dim: true
      })
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
  const bp = breakpointOf(l.columns)
  const lines: Line[] = []
  const boxes = bp !== "narrow" && g.pipe === "\u2502"
  const borderOf = (i: number): Partial<Segment> =>
    i === 1 ? { color: "accent" } : { color: "muted", dim: true }
  if (boxes) {
    const gap = bp === "medium" ? 12 : 19
    const w = Math.min(30, Math.floor((l.columns - 2 * gap) / 3))
    const content = (text: string) => fitAddressLine(text, w - 4, g)
    const top = (i: number): Line => [
      seg(`\u256d${g.rule.repeat(w - 2)}\u256e`, borderOf(i))
    ]
    const mid = (text: string, i: number, bold = false): Line => [
      seg(g.pipe, borderOf(i)),
      seg(" " + fit(bold ? text : content(text), w - 4) + " ", {
        bold,
        color: bold && i === 1 ? "accent" : bold ? "fg" : "muted"
      }),
      seg(g.pipe, borderOf(i))
    ]
    const bottom = (i: number): Line => [
      seg(`\u2570${g.rule.repeat(w - 2)}\u256f`, borderOf(i))
    ]
    const height = Math.max(...p.actors.map((a) => a.lines.length)) + 1
    const labels = [
      "",
      p.requestUri ? "INVITE" : "",
      p.requestUri ? (bp === "medium" ? "rewritten" : "INVITE rewritten") : ""
    ]
    const rowsOut: Line[][] = p.actors.map((a, i) => [
      top(i),
      mid(a.title, i, true),
      ...Array.from({ length: height - 1 }, (_, k) => mid(a.lines[k] ?? "", i)),
      bottom(i)
    ])
    const rowCount = height + 2
    // eslint-disable-next-line no-loops/no-loops
    for (let r = 0; r < rowCount; r++) {
      const line: Line = []
      p.actors.forEach((_, i) => {
        line.push(...rowsOut[i][r])
        if (i < p.actors.length - 1) {
          if (r === 1)
            line.push(
              seg(" " + fit(labels[i + 1] || "", gap - 2) + " ", {
                color: "muted"
              })
            )
          else if (r === 2)
            line.push(seg(" " + g.solid.repeat(gap - 3) + g.right + " "))
          else line.push(seg(" ".repeat(gap)))
        }
      })
      lines.push(line)
    }
  } else {
    const titleWidth = Math.max(...p.actors.map((a) => a.title.length)) + 2
    p.actors.forEach((a, i) => {
      lines.push([
        seg(fit(a.title, titleWidth), {
          bold: true,
          color: i === 1 ? "accent" : "fg"
        }),
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
  const section = (label: string) => {
    if (lines[lines.length - 1]?.length) lines.push([])
    lines.push([seg(label, { color: "muted" })])
  }
  section("REQUEST-URI")
  if (p.requestUri) {
    const one = `${p.requestUri.from}  ${"\u2192"}  ${p.requestUri.to}`
    if (one.length <= l.columns)
      lines.push([
        seg(p.requestUri.from),
        seg(`  ${"\u2192"}  `),
        seg(p.requestUri.to)
      ])
    else {
      lines.push([seg(p.requestUri.from)])
      lines.push([seg(`  ${"\u2192"} `), seg(p.requestUri.to)])
    }
  }
  section("VIA STACK, TOP FIRST")
  const viaWidth = Math.max(0, ...p.via.map((v) => v.line.length))
  p.via.forEach((v) => {
    const room = l.columns - 4 - Math.max(0, ...p.via.map((x) => x.note.length))
    wrap(v.line, Math.max(20, room), 4).forEach((t, i) =>
      lines.push(
        i === 0 && v.note
          ? [
              seg(fit(t, Math.min(viaWidth, room))),
              seg(`  ${g.pipe} `, { color: "muted", dim: true }),
              seg(v.note, {
                color: v.note.startsWith("ours") ? "accent" : "muted"
              })
            ]
          : [seg(t)]
      )
    )
  })
  section("ROUTE SET")
  lines.push([
    seg(fit("Route", 14), { color: "muted" }),
    seg(`${p.routeIn}, ${p.routeOut}`)
  ])
  lines.push([
    seg(fit("Record-Route", 14), { color: "muted" }),
    ...(p.recordRoute
      ? [seg(g.added + " ", { color: "success" }), seg(p.recordRoute)]
      : [seg("none")])
  ])
  if (p.notes.length) section("NOTES")
  const glyphWidth = Math.max(g.pass.length, g.fail.length, g.warn.length)
  p.notes.forEach((n) => {
    const glyph =
      n.color === "accent" ? g.pass : n.color === "warn" ? g.warn : g.fail
    const color: Color =
      n.color === "accent" ? "success" : n.color === "warn" ? "warn" : "danger"
    const indent = 1 + glyphWidth + 1
    wrap(n.text, Math.max(20, l.columns - indent), 0).forEach((t, i) =>
      lines.push(
        i === 0
          ? [seg(" "), seg(fit(glyph, glyphWidth), { color }), seg(" " + t)]
          : [seg(" ".repeat(indent) + t)]
      )
    )
  })
  return lines.slice(s.scroll)
}

/**
 * Fits a box line that may carry an address: the transport goes before
 * anything is clipped.
 *
 * @param {string} text - e.g. `in  10.111.221.2:5060/UDP`
 * @param {number} n - Cells
 * @param {Glyphs} g - Glyph set
 * @return {string} The text, at most n cells
 */
function fitAddressLine(text: string, n: number, g: Glyphs): string {
  if (text.length <= n) return text
  const stripped = text.replace(/\/[A-Z]+\b/g, "")
  return stripped.length <= n ? stripped : clip(stripped, n, g.ellipsis)
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
  const meta = (m: CallModel) =>
    `${m.recordedAt.slice(0, 10)}  routr ${
      m.records[0].edgePort.version ?? "?"
    }  ${m.verdict.word.toLowerCase()}  ${m.records.length} messages`
  // File names give way to the facts after them, never the other way round
  const metaWidth = Math.max(meta(a).length, meta(b).length)
  const nameWidth = Math.min(
    Math.max(a.file.length, b.file.length),
    Math.max(16, l.columns - 3 - metaWidth - 2)
  )
  const [nameA, nameB] = elidePair(a.file, b.file, nameWidth, g.ellipsis)
  const head = (m: CallModel, tag: string): Line => [
    seg(`${tag}  `, { color: tag === "B" ? "info" : "fg", bold: true }),
    seg(fit(m === a ? nameA : nameB, nameWidth + 2)),
    seg(meta(m), { color: "muted" })
  ]
  const differs = aligned.filter((r) => r.state === "differs").length
  const onlyA = aligned.filter((r) => r.state === "onlyA").length
  const onlyB = aligned.filter((r) => r.state === "onlyB").length
  const problems = differs + onlyA + onlyB
  const verdictText = problems
    ? `${g.differs} ${differs} of ${aligned.length} rows differ ${g.sep} ${onlyA} only in A ${g.sep} ${onlyB} only in B`
    : `${g.pass} all ${aligned.length} rows agree`
  const verdict: Line = [
    seg(verdictText, { color: problems ? "warn" : "success" })
  ]
  const lines: Line[] = [head(a, "A"), head(b, "B"), verdict]
  if (a.callId !== b.callId) {
    const note = `different calls: A ${a.callId}  B ${b.callId}`
    if (verdictText.length + 3 + note.length <= l.columns)
      verdict.push(seg("   " + note, { color: "muted" }))
    else lines.push([seg(note, { color: "muted" })])
  }
  lines.push([])

  const wide =
    breakpointOf(l.columns) !== "narrow" && breakpointOf(l.columns) !== "medium"
  const prefixW = 14
  const colW = wide
    ? Math.floor((l.columns - prefixW - 2) / 2)
    : l.columns - prefixW
  const cell = (r: Trace.TraceRecord | undefined, missing: string, w: number) =>
    r ? fitLabel(labelTiers(describe(r)), w, g) : missing
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
    const bar = sel ? { bg: "selection" as const, bold: true } : {}
    const seqs = `A${r.a ? r.a.seq : "\u2013"} B${r.b ? r.b.seq : "\u2013"}`
    const prefix = [
      seg(sel ? g.marker : " ", { color: "accent", ...bar }),
      seg(fit(stateGlyph(r.state), 2), { color: stateColor(r.state), ...bar }),
      seg(" " + fit(seqs, 9) + " ", { color: "muted", ...bar })
    ]
    if (wide) {
      body.push([
        ...prefix,
        seg(fit(cell(r.a, "not in A", colW), colW), {
          color: r.a ? "fg" : "muted",
          ...bar
        }),
        seg("  ", bar),
        seg(fit(cell(r.b, "not in B", colW), colW), {
          color: r.b ? "fg" : "muted",
          ...bar
        })
      ])
      if (l.columns >= 160 && r.state === "differs" && r.why)
        body.push([
          seg(" ".repeat(prefixW)),
          seg(fit(r.why, l.columns - prefixW), { color: "warn" })
        ])
    } else {
      body.push([
        ...prefix,
        seg(fit("A " + cell(r.a, "not in A", colW - 2), colW), {
          color: r.a ? "fg" : "muted",
          ...bar
        })
      ])
      body.push([
        seg(" ".repeat(prefixW), bar),
        seg(fit("B " + cell(r.b, "not in B", colW - 2), colW), {
          color: r.b ? "fg" : "muted",
          ...bar
        })
      ])
    }
  })
  const avail = rows - lines.length
  const selStart = rowStart[s.selected] ?? 0
  let start = 0
  if (selStart + 2 >= avail)
    start = Math.min(selStart - avail + 4, Math.max(0, body.length - avail))
  // Never open the window halfway into a stacked row
  start = rowStart.find((x) => x >= start) ?? start
  // ...and never close it halfway through one either
  const end =
    [...rowStart, body.length].filter((x) => x <= start + avail).pop() ??
    start + avail
  return { aligned, lines: [...lines, ...body.slice(start, end)] }
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
  const bodyRows = l.rows - 7
  let body: Line[]
  let position = ""
  if (s.help) {
    body = helpLines(bodyRows)
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
    ...header(a, b, l),
    [],
    viewBar(s, !!b, l),
    [],
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
