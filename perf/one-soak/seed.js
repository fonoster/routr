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
// Seeds routr-one for the one-soak benchmark: one Domain and the 200 callee
// and 200 caller Agents of callees.csv and callers.csv, each with its own
// Credentials. perfkit runs it once the UUT is up, on the load generator:
//   node one-soak/seed.js    (in node:22-alpine, working directory perf/)
// It installs @routr/sdk at the benchmarked version, so the SDK and the server
// always match, and exits non-zero on the first error.
const { execFileSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const DOMAIN_URI = "bench.routr.local"
const SEED_DIR = "/tmp/seed"

const uutIp = process.env.PERFKIT_UUT_IP
const version = process.env.PERFKIT_TARGET_VERSION

if (!uutIp || !version) {
  console.error("seed: PERFKIT_UUT_IP and PERFKIT_TARGET_VERSION must be set")
  process.exit(1)
}

// The SDK reads it as `insecure: true` for every client.
process.env.ALLOW_INSECURE = "true"

execFileSync(
  "npm",
  [
    "install",
    "--prefix",
    SEED_DIR,
    "--no-audit",
    "--no-fund",
    "--loglevel=error",
    `@routr/sdk@${version}`
  ],
  { stdio: "inherit" }
)

const SDK = require(path.join(SEED_DIR, "node_modules", "@routr/sdk")).default
const options = { endpoint: `${uutIp}:51908`, insecure: true }
const domains = new SDK.Domains(options)
const credentials = new SDK.Credentials(options)
const agents = new SDK.Agents(options)

// Users files: a SEQUENTIAL line, then username;password[;...] rows.
function readUsers(file) {
  return fs
    .readFileSync(path.join(__dirname, file), "utf8")
    .split("\n")
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [username, password] = line.split(";")
      return { username, password }
    })
}

async function createAgent(domainRef, user) {
  const creds = await credentials.createCredentials({
    name: `${user.username} credentials`,
    username: user.username,
    password: user.password
  })
  await agents.createAgent({
    name: user.username,
    username: user.username,
    domainRef,
    credentialsRef: creds.ref,
    privacy: "NONE",
    enabled: true,
    maxContacts: -1
  })
}

async function main() {
  const domain = await domains.createDomain({
    name: "Benchmarks",
    domainUri: DOMAIN_URI
  })
  const users = [...readUsers("callees.csv"), ...readUsers("callers.csv")]
  await users.reduce(
    (previous, user) => previous.then(() => createAgent(domain.ref, user)),
    Promise.resolve()
  )
  console.log(`seed: created Domain ${DOMAIN_URI} and ${users.length} Agents`)
}

main().catch((error) => {
  console.error(`seed: ${error.message}`)
  process.exit(1)
})
