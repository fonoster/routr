/*
 * Copyright (C) 2024 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster
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
/* eslint-disable require-jsdoc */
import cliui from "cliui"

// Number of spaces rendered between adjacent columns.
const COLUMN_GUTTER = 1

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableRow = Record<string, any>

export interface TableColumn {
  // Header text; when omitted the (title-cased) column key is used.
  header?: string
  // Minimum column width.
  minWidth?: number
  // Only rendered when the `extended` option is set.
  extended?: boolean
  // Custom cell accessor; when omitted the raw `row[key]` value is used.
  get?: (row: TableRow) => unknown
}

export type TableColumns = Record<string, TableColumn>

export interface TableOptions {
  // Suppress the header row.
  "no-header"?: boolean
  // Include columns flagged as `extended`.
  extended?: boolean
  // Sink for each rendered line; defaults to console.log.
  printLine?: (line: string) => void
  // Extra parsed flags are accepted and ignored (parity with the old API).
  [key: string]: unknown
}

// Title-cases a camelCase column key: "telUrl" -> "Tel Url", "ref" -> "Ref".
function defaultHeader(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value)
}

// Minimal, dependency-light reimplementation of the subset of the old
// `CliUx.ux.table` API used across the CLI. Renders left-aligned, space-padded
// columns so the output remains grep-friendly (no wrapping, no borders).
export function printTable(
  data: TableRow[],
  columns: TableColumns,
  options: TableOptions = {}
): void {
  const printLine = options.printLine ?? ((line: string) => console.log(line))
  const showHeader = !options["no-header"]

  // Resolve the visible columns honoring the `extended` flag.
  const visible = Object.entries(columns).filter(
    ([, col]) => !col.extended || options.extended === true
  )

  if (visible.length === 0) return

  const headers = visible.map(([key, col]) => col.header ?? defaultHeader(key))

  const rows = data.map((row) =>
    visible.map(([key, col]) => cellToString(col.get ? col.get(row) : row[key]))
  )

  // Natural width per column, clamped by the optional minWidth.
  const widths = visible.map(([, col], i) =>
    rows.reduce(
      (width, row) => Math.max(width, row[i].length),
      Math.max(headers[i].length, col.minWidth ?? 0)
    )
  )

  const ui = cliui({ width: widths.reduce((a, b) => a + b + COLUMN_GUTTER, 0) })

  const toCells = (texts: string[]) =>
    texts.map((text, i) => ({
      text,
      width: widths[i] + COLUMN_GUTTER,
      padding: [0, 0, 0, 0] as [number, number, number, number]
    }))

  if (showHeader) {
    ui.div(...toCells(headers))
  }

  rows.forEach((row) => ui.div(...toCells(row)))

  // cliui pads trailing whitespace; trim each line to keep output tidy.
  printLine(
    ui
      .toString()
      .split("\n")
      .map((line) => line.replace(/\s+$/, ""))
      .join("\n")
  )
}
