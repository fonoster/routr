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
// EdgePort runs its bundle in GraalJS with js.ecmascript-version=2017 (see
// mods/edgeport/src/main/java/io/routr/Launcher.java), which has no BigInt global. A
// dependency that touches BigInt crashes EdgePort at start with `ReferenceError: "BigInt" is
// not defined` (toml 5 did in 2.15.2). This fails the build instead.
const fs = require("fs")
const path = require("path")
const acorn = require("acorn")
const walk = require("acorn-walk")

const files = process.argv.slice(2)
if (files.length === 0) {
  files.push(
    path.join(__dirname, "..", "mods/edgeport/libs/edgeport.bundle.js")
  )
}

let failed = false
for (const file of files) {
  const code = fs.readFileSync(file, "utf8")
  let ast
  try {
    ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script" })
  } catch (e) {
    console.error(`${file}: cannot be parsed (${e.message})`)
    failed = true
    continue
  }
  const report = (node, what) => {
    const { line, column } = acorn.getLineInfo(code, node.start)
    console.error(
      `${file}:${line}:${column}: ${what}, which EdgePort's GraalJS lacks`
    )
    failed = true
  }
  walk.simple(ast, {
    Identifier(node) {
      if (node.name === "BigInt") report(node, "uses the BigInt global")
    },
    Literal(node) {
      if (node.bigint !== undefined)
        report(node, `uses the BigInt literal ${node.raw}`)
    }
  })
}

if (failed) process.exit(1)
console.log(`OK: ${files.join(", ")} use no BigInt`)
