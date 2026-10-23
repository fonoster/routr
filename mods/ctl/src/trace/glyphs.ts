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

/**
 * Every glyph the viewer draws, in a Unicode and an ASCII flavour. Every
 * state that uses a colour also uses one of these, so a screen reads the
 * same under NO_COLOR, TERM=dumb or a non-UTF-8 locale.
 */
export interface Glyphs {
  solid: string
  dashed: string
  right: string
  left: string
  dropped: string
  branch: string
  last: string
  pass: string
  fail: string
  warn: string
  challenge: string
  na: string
  differs: string
  removed: string
  changed: string
  added: string
  ellipsis: string
  dot: string
  delta: string
  sep: string
  marker: string
  times: string
  rule: string
  pipe: string
  gap: string
}

export const UNICODE: Glyphs = {
  solid: "─",
  dashed: "╌",
  right: "▶",
  left: "◀",
  dropped: "┤",
  branch: "├",
  last: "└",
  pass: "✓",
  fail: "✗",
  warn: "!",
  challenge: "?",
  na: "–",
  differs: "≠",
  removed: "−",
  changed: "~",
  added: "+",
  ellipsis: "…",
  dot: "●",
  delta: "Δ",
  sep: "·",
  marker: "▶",
  times: "×",
  rule: "─",
  pipe: "│",
  gap: "· · ·"
}

export const ASCII: Glyphs = {
  solid: "-",
  dashed: ".",
  right: ">",
  left: "<",
  dropped: "|",
  branch: "|-",
  last: "`-",
  pass: "ok",
  fail: "x",
  warn: "!",
  challenge: "?",
  na: "-",
  differs: "!=",
  removed: "-",
  changed: "~",
  added: "+",
  ellipsis: "...",
  dot: "*",
  delta: "d",
  sep: "-",
  marker: ">",
  times: "x",
  rule: "-",
  pipe: "|",
  gap: "..."
}

/**
 * Picks the glyph set from the environment: ASCII for TERM=dumb, a locale
 * without UTF-8, or an explicit request.
 *
 * @param {boolean} ascii - Explicit --ascii request
 * @param {NodeJS.ProcessEnv} env - Environment to inspect
 * @return {Glyphs} The glyph set
 */
export function pickGlyphs(
  ascii = false,
  env: NodeJS.ProcessEnv = process.env
): Glyphs {
  if (ascii || env.TERM === "dumb") return ASCII
  const locale = env.LC_ALL || env.LC_CTYPE || env.LANG || ""
  if (locale && !/utf-?8/i.test(locale)) return ASCII
  return UNICODE
}
