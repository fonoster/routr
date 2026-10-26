#!/usr/bin/env node
/* Adds the entry for a release to docs-site/changelog.mdx, built from the feat, fix, perf,
   refactor and revert commits since the previous tag; breaking changes come first. Lerna runs
   it from the root "version" script, before the release tag exists, so the entry lands in the
   release commit. Each line is a commit subject: reword the big ones by hand afterwards.
   No-op when the changelog already has the version, so a re-run adds nothing.

     node .scripts/changelog-entry.js <version> [path/to/changelog.mdx] */
const { execSync } = require("child_process")
const fs = require("fs")

const version = process.argv[2]
const file = process.argv[3] || "docs-site/changelog.mdx"

if (!version) {
  console.error("usage: changelog-entry.js <version> [changelog.mdx]")
  process.exit(1)
}

const label = `v${version}`
const changelog = fs.readFileSync(file, "utf8")

if (changelog.includes(`<Update label="${label}"`)) {
  console.log(`${file} already has ${label}`)
  process.exit(0)
}

const git = (cmd) => execSync(`git ${cmd}`, { encoding: "utf8" }).trim()
const previous = git("describe --tags --abbrev=0")
const log = git(`log --no-merges --format=%s%x1f%b%x1e ${previous}..HEAD`)

const subject = /^(feat|fix|perf|refactor|revert)(\(([^)]*)\))?(!)?: (.+)$/
const breaking = []
const changes = []

for (const record of log.split("\x1e")) {
  const [title = "", body = ""] = record.trim().split("\x1f")
  const match = title.match(subject)
  if (!match) continue
  const [, , , scope, bang, text] = match
  const line =
    text.charAt(0).toUpperCase() + text.slice(1) + (scope ? ` (\`${scope}\`)` : "")
  if (bang || /^BREAKING CHANGE:/m.test(body)) breaking.push(`**Breaking:** ${line}`)
  else changes.push(line)
}

if (breaking.length + changes.length === 0) {
  console.log(`no user-facing commits since ${previous}; ${file} unchanged`)
  process.exit(0)
}

const date = new Date().toISOString().slice(0, 10)
const items = [...breaking, ...changes].map((line) => `  - ${line}`).join("\n")
const entry =
  `<Update label="${label}" description="${date}">\n${items}\n\n` +
  `  [Release notes](https://github.com/fonoster/routr/releases/tag/${label})\n` +
  `</Update>\n\n`

const at = changelog.indexOf("<Update ")
if (at === -1) {
  console.error(`no <Update> block in ${file} to insert before`)
  process.exit(1)
}

fs.writeFileSync(file, changelog.slice(0, at) + entry + changelog.slice(at))
console.log(`added ${label} to ${file}`)
