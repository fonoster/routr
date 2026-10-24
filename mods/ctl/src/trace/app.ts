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
  paintSplash,
  VIEWS,
  ViewState,
  visibleRows
} from "./paint"
import { Background, Color, Line } from "./text"

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

export interface Palette {
  colors: Record<Color, string | undefined>
  // The quietest tone, for rails, dividers and gap rows (never SGR dim,
  // which renders unpredictably over hex colours)
  dim: Partial<Record<Color, string>>
  backgrounds: Record<Background, string>
  // Text on the teal chip is never white
  onAccent: string
}

// Routr brand tokens on a dark terminal: teal is the brand, green means ok.
// fg stays undefined so normal text keeps the terminal's own colour.
export const DARK: Palette = {
  colors: {
    accent: "#5FCFCE",
    success: "#39E19E",
    danger: "#F97066",
    warn: "#F5A524",
    info: "#60A5FA",
    muted: "#8D8D8D",
    fg: undefined
  },
  dim: { muted: "#555555", fg: "#8D8D8D" },
  backgrounds: {
    accent: "#5FCFCE",
    selection: "#333333",
    mark: "#E8E8E8",
    dot: "#5FCFCE"
  },
  onAccent: "#001A1A"
}

// The same roles on a light terminal: darker hues that keep 4.5:1 on white,
// a pale selection bar so the terminal's dark text stays readable on it
export const LIGHT: Palette = {
  colors: {
    accent: "#0B7A79",
    success: "#0A7F4F",
    danger: "#C4321F",
    warn: "#A85F00",
    info: "#1F5FD0",
    muted: "#6E6E6E",
    fg: undefined
  },
  dim: { muted: "#B5B5B5", fg: "#6E6E6E" },
  backgrounds: {
    accent: "#5FCFCE",
    selection: "#E2E8E8",
    mark: "#1F2328",
    dot: "#0B7A79"
  },
  onAccent: "#001A1A"
}

/**
 * Resolves a segment's semantic style to what Ink's Text takes.
 *
 * @param {object} x - A segment
 * @param {Palette} p - The palette for the terminal's background
 * @return {object} Ink Text props
 */
export function inkStyle(
  x: {
    color?: Color
    bold?: boolean
    bg?: Background
    dim?: boolean
  },
  p: Palette = DARK
): {
  color?: string
  backgroundColor?: string
  bold?: boolean
} {
  const base = x.color ? p.colors[x.color] : undefined
  const color = x.dim && x.color ? p.dim[x.color] ?? base : base
  return {
    color: x.bg === "accent" ? p.onAccent : color,
    ...(x.bg ? { backgroundColor: p.backgrounds[x.bg] } : {}),
    bold: x.bold
  }
}

/**
 * Whether a terminal background is light, from an OSC 11 reply
 * ("rgb:RRRR/GGGG/BBBB", 1 to 4 hex digits per channel).
 *
 * @param {string} reply - What the terminal answered
 * @return {boolean | undefined} true when light, undefined when unparseable
 */
export function isLightReply(reply: string): boolean | undefined {
  const m = /rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})/i.exec(reply)
  if (!m) return undefined
  const [r, g, b] = m
    .slice(1)
    .map((h) => parseInt(h, 16) / (16 ** h.length - 1))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5
}

/**
 * Whether COLORFGBG ("fg;bg", set by rxvt, Konsole and others) names a
 * light background.
 *
 * @param {string | undefined} value - The variable
 * @return {boolean | undefined} true when light, undefined when absent
 */
export function isLightColorFgBg(value?: string): boolean | undefined {
  const bg = Number(value?.split(";").pop())
  if (!value || Number.isNaN(bg)) return undefined
  return bg === 7 || bg === 15
}

/**
 * Picks the palette for the terminal: asks for the background colour with
 * OSC 11 and waits briefly for the reply; falls back to COLORFGBG, then dark.
 *
 * @param {number} timeoutMs - How long to wait for the terminal
 * @return {Promise<Palette>} The palette
 */
export async function detectPalette(timeoutMs = 150): Promise<Palette> {
  const hint = isLightColorFgBg(process.env.COLORFGBG)
  const { stdin, stdout } = process
  if (!stdin.isTTY || !stdout.isTTY) return hint ? LIGHT : DARK
  const reply = await new Promise<string>((resolve) => {
    let buf = ""
    const done = () => {
      clearTimeout(timer)
      stdin.off("data", onData)
      stdin.setRawMode(false)
      stdin.pause()
      resolve(buf)
    }
    const onData = (d: Buffer) => {
      buf += d.toString("latin1")
      // The reply ends with BEL or ST (ESC \\)
      if (buf.includes("\x07") || buf.includes("\x1b\\")) done()
    }
    const timer = setTimeout(done, timeoutMs)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on("data", onData)
    stdout.write("\x1b]11;?\x1b\\")
  })
  const light = isLightReply(reply) ?? hint
  return light ? LIGHT : DARK
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
  // false skips the splash (tests, --select, scripted runs)
  splash?: boolean
}

// How long the splash blinks before the first view opens
const SPLASH_MS = 5000

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
  const palette = await detectPalette()
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
    // The splash blinks the dot for a few seconds; any key skips it
    const [splash, setSplash] = React.useState(opts.splash !== false)
    const [dotOn, setDotOn] = React.useState(true)
    React.useEffect(() => {
      if (!splash) return undefined
      const blink = setInterval(() => setDotOn((on) => !on), 420)
      const end = setTimeout(() => setSplash(false), SPLASH_MS)
      return () => {
        clearInterval(blink)
        clearTimeout(end)
      }
    }, [splash])
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
      // The message clock starts once the splash is gone, so a warning
      // raised at load time is on screen for its full 3 s
      if (!s.message || splash) return undefined
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(
        () => setS((prev) => ({ ...prev, message: undefined })),
        3000
      )
      return () => {
        if (timer.current) clearTimeout(timer.current)
      }
    }, [s.message, splash])

    // Keep the latest state in a ref so the key handler never updates
    // state from inside an updater (React forbids side effects there)
    const latest = React.useRef(s)
    latest.current = s

    useInput((input: string, key: Key) => {
      // A colour reply that came back after the probe gave up is not a key
      if (/\]11;|rgb:[0-9a-f]+\//i.test(input)) return
      if (splash) {
        setSplash(false)
        return
      }
      const prev = latest.current
      const next = reduce(prev, input, key, {
        a,
        b,
        rows: size.rows - 8,
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
    const lines = splash
      ? paintSplash(a.file, dotOn, layout)
      : paintScreen(a, b, s, layout)
    return h(
      Box,
      { flexDirection: "column", width: size.columns },
      ...lines.map((line: Line, i: number) =>
        h(
          Text,
          { key: i, wrap: "truncate-end" },
          line.length
            ? line.map((x, j) =>
                h(Text, { key: j, ...inkStyle(x, palette) }, x.text)
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
