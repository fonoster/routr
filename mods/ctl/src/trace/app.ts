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
import { alignTraces, CallModel } from "./model"
import {
  initialState,
  Layout,
  paintScreen,
  VIEWS,
  ViewState,
  visibleRows
} from "./paint"
import { Color, Line } from "./text"

// Ink is ESM-only; rctl is CommonJS. The dynamic import below is preserved
// by the node16 module setting, so this works on Node 22 without a bundler.
// The module name goes through a variable so the root (commonjs) tsconfig
// used by the test runner does not try to resolve Ink's ESM-only exports.
const INK = "ink"
const REACT = "react"

/* eslint-disable @typescript-eslint/no-explicit-any */
interface InkModule {
  Box: any
  Text: any
  render: (
    node: any,
    options?: { exitOnCtrlC?: boolean }
  ) => { waitUntilExit: () => Promise<void> }
  useApp: () => { exit: (error?: Error) => void }
  useInput: (handler: (input: string, key: Key) => void) => void
  useStdout: () => { stdout: NodeJS.WriteStream }
}
interface ReactModule {
  createElement: (...args: any[]) => any
  useState: <T>(initial: T) => [T, (next: T | ((prev: T) => T)) => void]
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void
  useRef: <T>(initial: T) => { current: T }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const COLORS: Record<Color, string | undefined> = {
  accent: "#39e19e",
  danger: "#f97066",
  warn: "#e8c07d",
  info: "#82aaff",
  muted: "#9a9a9a",
  fg: undefined
}

/** The key flags Ink's useInput reports; declared here so the reducer has no ESM type import. */
export interface Key {
  upArrow?: boolean
  downArrow?: boolean
  leftArrow?: boolean
  rightArrow?: boolean
  pageDown?: boolean
  pageUp?: boolean
  return?: boolean
  escape?: boolean
  ctrl?: boolean
  shift?: boolean
  tab?: boolean
  backspace?: boolean
  delete?: boolean
  meta?: boolean
}

export interface AppOptions {
  view: number
  g: Glyphs
  select?: number
}

/**
 * Applies one key press to the state. Pure, so the key map is testable
 * without a terminal.
 *
 * @param {ViewState} s - Current state
 * @param {string} input - Printable input, if any
 * @param {Partial<Key>} key - Ink key flags
 * @param {object} ctx - What the key needs to know about the models
 * @return {ViewState | "quit"} The next state, or a request to quit
 */
export function reduce(
  s: ViewState,
  input: string,
  key: Partial<Key>,
  ctx: {
    a: CallModel
    b?: CallModel
    rows: number
    columns: number
    listLength: number
    problems: number[]
  }
): ViewState | "quit" {
  const { listLength, problems } = ctx
  const clampSel = (n: number) =>
    Math.max(0, Math.min(Math.max(0, listLength - 1), n))
  const say = (message: string): ViewState => ({ ...s, message })

  if (s.help) return { ...s, help: false }
  if (s.filterInput !== undefined) {
    if (key.return)
      return {
        ...s,
        filter: s.filterInput,
        filterInput: undefined,
        selected: 0
      }
    if (key.escape)
      return { ...s, filter: "", filterInput: undefined, selected: 0 }
    if (key.backspace || key.delete)
      return { ...s, filterInput: s.filterInput.slice(0, -1) }
    if (input && !key.ctrl && !key.meta)
      return { ...s, filterInput: s.filterInput + input }
    return s
  }

  if (input === "q" || (key.ctrl && input === "c")) return "quit"
  if (input === "?") return { ...s, help: true }
  if (key.escape)
    return s.filter
      ? { ...s, filter: "", selected: 0 }
      : { ...s, message: undefined }

  const isList = s.view === 1 || s.view === 3
  if (/^[1-4]$/.test(input)) {
    const view = Number(input) - 1
    if (view === 3 && !ctx.b)
      return say("no second file loaded; run with --compare <file>")
    return { ...s, view, selected: 0, scroll: 0, message: undefined }
  }
  const next = (d: number): ViewState => {
    let view = (s.view + d + VIEWS.length) % VIEWS.length
    if (view === 3 && !ctx.b) view = (view + d + VIEWS.length) % VIEWS.length
    return { ...s, view, selected: 0, scroll: 0, message: undefined }
  }
  if (key.tab && !key.shift) return next(1)
  if (key.tab && key.shift) return next(-1)
  if (input === "]" || key.rightArrow || input === "l") return next(1)
  if (input === "[" || key.leftArrow || input === "h") return next(-1)

  if (input === "n" || input === "N") {
    const dir = input === "n" ? 1 : -1
    if (s.view === 0) {
      const failed = ctx.a.checks
        .map((c, i) => (c.state === "fail" || c.state === "warn" ? i : -1))
        .filter((i) => i >= 0)
      if (!failed.length) return say("no problems in this trace")
      const pos = failed.indexOf(s.checkIndex)
      const nextPos = pos + dir
      if (nextPos < 0 || nextPos >= failed.length)
        return say(
          nextPos >= failed.length ? "no more problems" : "no earlier problems"
        )
      const idx = failed[nextPos]
      return { ...s, checkIndex: idx, message: ctx.a.checks[idx].explain }
    }
    if (!problems.length) return say("no problems in this trace")
    const after = problems.filter((p) =>
      dir > 0 ? p > s.selected : p < s.selected
    )
    if (!after.length)
      return say(dir > 0 ? "no more problems" : "no earlier problems")
    return {
      ...s,
      selected: dir > 0 ? after[0] : after[after.length - 1],
      message: undefined
    }
  }

  if (isList) {
    if (input === "j" || key.downArrow)
      return { ...s, selected: clampSel(s.selected + 1) }
    if (input === "k" || key.upArrow)
      return { ...s, selected: clampSel(s.selected - 1) }
    if (input === "g") return { ...s, selected: 0 }
    if (input === "G") return { ...s, selected: clampSel(listLength - 1) }
    if ((key.ctrl && input === "d") || key.pageDown)
      return { ...s, selected: clampSel(s.selected + Math.floor(ctx.rows / 2)) }
    if ((key.ctrl && input === "u") || key.pageUp)
      return { ...s, selected: clampSel(s.selected - Math.floor(ctx.rows / 2)) }
    if (key.return && s.view === 1) {
      const row = visibleRows(ctx.a, s)[s.selected]
      if (!row) return s
      return {
        ...s,
        expanded: s.expanded === row.index ? undefined : row.index
      }
    }
    if (input === "d") {
      if (s.view === 3)
        return {
          ...s,
          paneMode: s.paneMode === "ab" ? "diff" : "ab",
          view: 1,
          selected: compareToLadder(ctx, s.selected)
        }
      return { ...s, paneMode: s.paneMode === "headers" ? "diff" : "headers" }
    }
    if (input === "p")
      return { ...s, paneVisible: !(s.paneVisible ?? ctx.columns >= 100) }
    if (input === "t")
      return { ...s, timeMode: ((s.timeMode + 1) % 3) as 0 | 1 | 2 }
    if (input === "c")
      return ctx.b
        ? { ...s, overlay: !s.overlay }
        : say("no second file loaded; run with --compare <file>")
    if (input === "x") return { ...s, showRetrans: !s.showRetrans, selected: 0 }
    if (input === "/") return { ...s, filterInput: "" }
  } else {
    if (input === "j" || key.downArrow) return { ...s, scroll: s.scroll + 1 }
    if (input === "k" || key.upArrow)
      return { ...s, scroll: Math.max(0, s.scroll - 1) }
  }
  return s
}

const compareToLadder = (
  ctx: { a: CallModel; b?: CallModel },
  selected: number
): number => {
  if (!ctx.b) return 0
  const row = alignTraces(ctx.a.records, ctx.b.records)[selected]
  if (!row?.a) return 0
  const rows = visibleRows(ctx.a, initialState())
  const idx = rows.findIndex((r) => ctx.a.records[r.index] === row.a)
  return Math.max(0, idx)
}

/**
 * Problems reachable with n in the current view, as indices into the list.
 *
 * @param {CallModel} a - Model A
 * @param {CallModel | undefined} b - Model B
 * @param {ViewState} s - State
 * @return {number[]} Sorted list indices
 */
export function problemIndices(
  a: CallModel,
  b: CallModel | undefined,
  s: ViewState
): number[] {
  if (s.view === 1) {
    return visibleRows(a, s)
      .map((r, i) => (r.rejected ? i : -1))
      .filter((i) => i >= 0)
  }
  if (s.view === 3 && b) {
    return alignTraces(a.records, b.records)
      .map((r, i) => (r.state === "same" ? -1 : i))
      .filter((i) => i >= 0)
  }
  return []
}

/**
 * Length of the list the selection moves over in the current view.
 *
 * @param {CallModel} a - Model A
 * @param {CallModel | undefined} b - Model B
 * @param {ViewState} s - State
 * @return {number} The length
 */
export function listLength(
  a: CallModel,
  b: CallModel | undefined,
  s: ViewState
): number {
  if (s.view === 1) return visibleRows(a, s).length
  if (s.view === 3 && b) return alignTraces(a.records, b.records).length
  return 0
}

/**
 * Runs the interactive viewer until the user quits.
 *
 * @param {CallModel} a - Model A
 * @param {CallModel | undefined} b - Model B
 * @param {AppOptions} opts - Options
 * @return {Promise<void>} Resolves when the app exits
 */
export async function runApp(
  a: CallModel,
  b: CallModel | undefined,
  opts: AppOptions
): Promise<void> {
  const ink = (await import(INK)) as InkModule
  const React = (await import(REACT)) as ReactModule
  const { Box, Text, render, useApp, useInput, useStdout } = ink
  const h = React.createElement

  const start: ViewState = { ...initialState(opts.view) }
  if (opts.select !== undefined) {
    const idx = visibleRows(a, start).findIndex(
      (r) => a.records[r.index].seq === opts.select
    )
    if (idx >= 0) {
      start.selected = idx
      start.expanded = visibleRows(a, start)[idx].index
    }
  }
  if (a.truncatedLines)
    start.message = `last line is truncated; showing ${a.records.length} of ${a.totalLines} records`

  const App = () => {
    const { exit } = useApp()
    const { stdout } = useStdout()
    const [size, setSize] = React.useState({
      columns: stdout.columns || 80,
      rows: stdout.rows || 24
    })
    const [s, setS] = React.useState<ViewState>(start)
    const timer = React.useRef<NodeJS.Timeout | undefined>(undefined)

    React.useEffect(() => {
      const onResize = () => {
        // Clear what the old size left behind; Ink repaints the new frame
        stdout.write("\x1b[2J\x1b[H")
        setSize({ columns: stdout.columns || 80, rows: stdout.rows || 24 })
      }
      stdout.on("resize", onResize)
      return () => {
        stdout.off("resize", onResize)
      }
    }, [stdout])

    React.useEffect(() => {
      if (!s.message) return undefined
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(
        () => setS((prev) => ({ ...prev, message: undefined })),
        3000
      )
      return () => {
        if (timer.current) clearTimeout(timer.current)
      }
    }, [s.message])

    // Keep the latest state in a ref so the key handler never updates
    // state from inside an updater (React forbids side effects there)
    const latest = React.useRef(s)
    latest.current = s

    useInput((input: string, key: Key) => {
      const prev = latest.current
      const next = reduce(prev, input, key, {
        a,
        b,
        rows: size.rows - 3,
        columns: size.columns,
        listLength: listLength(a, b, prev),
        problems: problemIndices(a, b, prev)
      })
      if (next === "quit") {
        exit()
        return
      }
      if (next !== prev) setS(next)
    })

    const layout: Layout = {
      columns: size.columns,
      rows: size.rows - 1,
      g: opts.g
    }
    const lines = paintScreen(a, b, s, layout)
    return h(
      Box,
      { flexDirection: "column", width: size.columns },
      ...lines.map((line: Line, i: number) =>
        h(
          Text,
          { key: i, wrap: "truncate-end" },
          line.length
            ? line.map((x, j) =>
                h(
                  Text,
                  {
                    key: j,
                    color: x.color ? COLORS[x.color] : undefined,
                    bold: x.bold,
                    inverse: x.inverse,
                    dimColor: x.dim
                  },
                  x.text
                )
              )
            : " "
        )
      )
    )
  }

  // Alternate screen so the ladder never scrolls the shell history
  process.stdout.write("\x1b[?1049h\x1b[H")
  const instance = render(h(App), { exitOnCtrlC: true })
  try {
    await instance.waitUntilExit()
  } finally {
    process.stdout.write("\x1b[?1049l")
  }
}
