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
// Writes the resources RoutrOne's files backend reads for a benchmark: one
// Domain and an Agent with Credentials for each row of the SIPp users files in
// the directory given, to <dir>/resources/resources.yaml.
//   node perf/gen_resources.js perf/one-soak callees.csv callers.csv
//   node perf/gen_resources.js perf/one-mix register.csv callers.csv
// A row is username;password;... after a first SEQUENTIAL line. A callers file
// names a third field, its callee; a callee that appears only there is an Agent
// that never registers (the offline calls of the mix).
const fs = require("fs")
const path = require("path")

const [dir, ...files] = process.argv.slice(2)
if (!dir || files.length === 0) {
  console.error("usage: gen_resources.js <dir> <users.csv>...")
  process.exit(1)
}

const rowsOf = (file) =>
  fs
    .readFileSync(path.join(dir, file), "utf8")
    .split("\n")
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(";"))

const domain = `- apiVersion: v2beta1
  kind: Domain
  ref: domain-bench
  metadata:
    name: Benchmarks
  spec:
    context:
      domainUri: bench.routr.local
`

const agentOf = (username, password) => `- apiVersion: v2beta1
  kind: Credentials
  ref: cred-${username}
  metadata:
    name: ${username} credentials
  spec:
    credentials:
      username: ${username}
      password: ${password}
- apiVersion: v2beta1
  kind: Agent
  ref: agent-${username}
  metadata:
    name: ${username}
  spec:
    username: ${username}
    domainRef: domain-bench
    credentialsRef: cred-${username}
    privacy: None
`

const users = new Map()
files
  .flatMap(rowsOf)
  .forEach(([username, password, callee]) => {
    users.set(username, password)
    // bench-pass-NNNNN is the password of both callerNNNNN and calleeNNNNN
    if (callee && callee.startsWith("callee") && !users.has(callee)) {
      users.set(callee, password)
    }
  })

const out = path.join(dir, "resources")
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(
  path.join(out, "resources.yaml"),
  domain + [...users].map(([u, p]) => agentOf(u, p)).join("")
)
console.log(`${out}: 1 Domain and ${users.size} Agents`)
