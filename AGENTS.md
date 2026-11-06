# AGENTS.md

## Overview

Routr is a SIP proxy, location server and registrar for carriers, communication service
providers and integrators. This branch, `v3`, is Routr 3, designed in `ROUTR3.md`; `CORE.md`
and `CONNECT.md` are the behavior specs it keeps. One Go module at the root
(`github.com/fonoster/routr`: `cmd/`, `internal/`, `protos/`) plus the TypeScript workspaces
in `mods/` (npm workspaces and Lerna; Node 22). Connect is the default processor. Routr 2 is
in maintenance on `main`; nothing is released from `v3` until 3.0.0. User docs live in
`docs-site/` (Mintlify, docs.routr.io).

## Commands

- Install: `npm ci`. Not `npm install`: it drifts `@oclif/core` past the pinned version and
  breaks the `@routr/ctl` build.
- Build for tests: `npx lerna run build`. Workspaces resolve to `dist/`, so tests need a
  build first. `@routr/common`'s `postbuild` copies `protos/` into `dist/`.
- Go: `test -z "$(gofmt -l .)" && go vet ./... && go test -race ./...` (Go 1.26, at the
  root). One package: `go test ./internal/edgeport/...`.
- gRPC stubs: `scripts/protoc.sh` regenerates `internal/common/pb` from `protos/` with
  protoc 29.3, protoc-gen-go v1.36.6 and protoc-gen-go-grpc v1.5.1; the output is committed.
- Unit tests: `npm test` (`mods/*/test/*.unit.test.ts`). One package:
  `npx cross-env NODE_ENV=dev mocha mods/<name>/test/*.unit.test.ts`.
- Typecheck: `npm run typecheck`. Lint: `npx eslint mods --ext .ts` (`npm run lint` adds
  `--fix`).
- Corpus replay: `npm run compat -- --sip-connect` (after the build) replays everything on
  the Node chain; `./scripts/compat-go.sh --sip-connect` replays the same manifests
  (`etc/corpus/manifest.yaml`, `interop/*/manifest.yaml`) on the Go chain. SEET runs `etc/seet.json`.
- SEET locally: `npm ci && npm run build && sh .scripts/dev-certs.sh`, then
  `docker compose -f compose.yaml -f compose.dev.yaml up --build -d`, then
  `docker compose -f compose.yaml -f compose.dev.yaml up --abort-on-container-exit --exit-code-from compliance compliance`.
- Not gated in CI: `npm run test:integration` (needs Redis), the `@routr/ctl` suite.
- Benchmarks (not gated in CI; costs money: two DigitalOcean droplets; needs
  `DIGITALOCEAN_TOKEN` and npm 11):
  `npx -y github:fonoster/perfkit#v0.1.12 run --config perf/perfkit.yaml --target-version <x.y.z>`
  (`perf/perfkit.smoke.yaml` is the under-an-hour check). Guide:
  `docs-site/guides/run-a-benchmark.mdx`.
- CI (`.github/workflows/test.yaml`) runs on pull requests to `v3`: unit, typecheck and
  lint; corpus compatibility; SEET compliance against the full compose stack; Go (gofmt,
  vet, race tests). A PR that touches only `docs/`, `docs-site/`, `site/`, `designs/` or
  Markdown skips them.
- The pre-commit hook runs `npm test`, format, lint, typecheck and `generate:readme`.

Default Verify per area:

- sip-core: `go test -race ./...`, `npm test` and `npm run compat -- --sip-connect`.
- interop: `npm run compat -- --sip-connect`; the SEET job on the PR.
- infra: the PR's Tests run; for the chart, `npm run helm:package`.

## Conventions

Go and TypeScript never share a directory. `protos/` is the single source for both
languages; `@routr/common` copies it at build. Conventional commits, enforced by commitlint.

### TypeScript (`mods/`)

Profile: typescript

New code follows the profile: validated functions (a factory with injected dependencies,
Zod input validation, `withErrorHandlingAndValidation`), one function per file, and a test
per function including the validation-failure case. Existing code changes only when an
issue asks for it.

Overrides (the profile yields to these):

- CommonJS modules; relative imports carry no extension, not the profile's ESM `.js`.
- Snake_case file names (`create_widget.ts`), not `createWidget.ts`.
- Every source file starts with the MIT header in `.scripts/copyright.js` (ESLint
  `notice/notice` enforces it).
- Prettier: no semicolons, double quotes, no trailing commas, width 80.
- ESLint `google` plus `no-loops`: no `for`/`while` loops.
- Shared schemas, types and errors go in `mods/common`, the profile's shared package.
- YAML config stays validated with Ajv JSON schemas (`src/config/schema.ts`); Zod is for
  function input.
- Tests: mocha, chai, sinon, sinon-chai; files named `*.unit.test.ts` (`*.int.test.ts` for
  integration).

### Go (`cmd/`, `internal/`)

Profile: repo-native

Examples: `internal/edgeport/edgeport.go`, `internal/edgeport/transactions.go`,
`internal/common/config/config.go`.

- `gofmt`, `go vet`, `go test -race ./...`; the MIT header as a Go comment.
- One package per component; a component's public surface is its interface and its
  `New` constructor; everything else is `internal`.
- No goroutine without an owner that stops it; no global mutable state outside the
  component's struct.
- Every per-message or per-transaction operation is O(1); a scan is a bug.
- Errors are values with context; a failed lookup is a SIP answer, never a crash.
- Tests: a unit test per function with the validation-failure case; wire tests against the
  Java converter fixtures; the corpus replay and SEET in CI for every PR.

## Areas

| Area label | Paths | Experts |
| :--- | :--- | :--- |
| area: sip-core | cmd/edgeport, internal/edgeport, internal/common/sipconv, mods/dispatcher, mods/processor, mods/location, mods/connect, mods/registry, mods/rtprelay, mods/common/src/ip_utils.ts | realtime-comms-engineer |
| area: interop | mods/connect, mods/common/src/trace, etc/corpus, etc/scenarios, interop | realtime-comms-engineer |
| area: infra | ops/charts, cmd/*/Dockerfile, mods/*/Dockerfile, compose*.yaml, .github/workflows, .scripts, scripts, perf/ | release-engineer, security-engineer |
| (none) | mods/simpledata | database-engineer |
| (none) | mods/ctl, mods/sdk, docs-site | technical-writer |

## Labels
These are the only labels; any other is deleted. An issue's kind is its native issue type (Bug,
Feature, Task), not a label. Close as "not planned" or "duplicate" instead of labeling.

| Label | Meaning | Applied by |
| :--- | :--- | :--- |
| needs-triage | Filed, not yet shaped | Issue forms |
| needs-info | Waiting on the reporter | /ps:report |
| ready | Plan approved; agents may implement | A maintainer |
| not-ready | The implementer refused; see its comment | /ps:implement |
| blocked | An agent stopped on a blocker | Any ps skill |
| needs-human | A loop limit was hit or a decision needs a maintainer | Any ps skill |
| needs-issue | A pull request with no linked issue | require-linked-issue workflow |
| breaking | Needs a major bump or a migration note | /ps:report |
| risk: high | A maintainer reviews the plan before work starts | /ps:report |
| external | Opened by someone outside the org | label-external workflow |
| good first issue | A ready issue a newcomer can take | A maintainer |
| dependencies | Dependency update | Dependabot |

Plus one `area:` label per labeled row of `## Areas`; `(none)` rows get no label.

## Compatibility

Breaking (a major release, `!` in the commit subject):

- The gRPC APIs: `protos/` and `protos/connect`, unchanged in 3.0 (`ROUTR3.md` § 1).
- The `rctl` CLI (`mods/ctl`): commands and flags.
- The `@routr/sdk` public API.
- The YAML config shapes and, for the Node services still on `v3`, their env vars
  (`mods/*/src/envs.ts`) and config schemas (`mods/*/src/config/schema.ts`).
- Helm values in `ops/charts/connect/values.yaml` (Routr 2's chart until milestone 3).
- The database schema: Routr 3 runs on Routr 2's PostgreSQL schema as it is (`ROUTR3.md`
  § 1); the schema and its migrations are recorded on `main` (`mods/pgdata/schema.prisma`,
  `mods/pgdata/migrations`). A schema change is out of scope for 3.0 (`ROUTR3.md` § 7).
- SIP wire behavior, as replayed by the corpus in `etc/corpus` and `interop/`.
- The converter fixtures in `internal/common/sipconv/testdata`: a changed fixture is a
  changed wire contract.

## Risk hotspots

- `internal/edgeport`: the SIP transport.
- `internal/common/sipconv`: the wire contract with every processor.
- `protos/` and `scripts/protoc.sh`: both languages' gRPC contract.
- `mods/connect/src/router.ts` and `mods/connect/src/handlers`: Connect routing.
- `mods/processor/src/alterations.ts` and `mods/dispatcher/src`: every request passes
  through them.
- `ops/charts/connect` (`values.yaml`, `templates/edgeport`) and the Dockerfiles.
- `.github/workflows/release.yaml`, `.scripts/next-release.sh`, `.scripts/bump-chart.sh`.

## Release

Nothing releases from `v3`: `release.yaml` runs on pushes to `main` only and is dormant
here until milestone 3; `v3` becomes `main` at 3.0.0. PRs merge into `v3` one at a time
with the Tests checks green: Detect changes, Unit tests, typecheck and lint, Known-good
corpus compatibility, SIP Connect v1.1 compliance (SEET), Go.

On `main` (Routr 2):

- Every push to main releases (`.github/workflows/release.yaml`). Main requires the Tests
  checks and an up-to-date branch, so main is not tested again.
- `.scripts/next-release.sh` reads commit subjects since the last tag: `feat` is minor;
  `fix`, `refactor`, `perf`, `revert` are patch; a `!` or `BREAKING CHANGE:` subject is
  major; `test`, `style`, `docs`, `chore`, `ci`, `build` release nothing.
- One release publishes npm, then the Docker images (amd64 and arm64), then the Helm chart,
  then the GitHub release.
- Merge PRs one at a time and wait for each release: overlapping runs race for the tag.
- Retry a failed release with `gh workflow run release.yaml`; with no new commits it
  re-publishes the current tag.
- Keep the workflow's file name: npm trusted publishing trusts only `release.yaml`.
- Benchmarks are manual (`.github/workflows/benchmarks.yaml`, Run workflow) and publish to
  gh-pages `/benchmarks` without a push to main, so they never release. `keep_files: true`
  must stay in `gh-pages.yaml`, or a website deploy deletes the report history; both
  workflows share the `gh-pages` concurrency group.

## Expert notes

### realtime-comms-engineer

- **SIPconnect 1.1 applies to Connect and what supports it, only.** Routr adopted the
  [SIPconnect 1.1 Technical Recommendation](https://www.sipforum.org/download/sipconnect-technical-recommendation-version-1-1/)
  for the Connect processor (`mods/connect`, specified in `CONNECT.md`). It also governs the
  modules where they support Connect (`mods/sdk`, `mods/registry`, `mods/ctl`) and the tooling that checks it: the `sip-connect` trace rules
  (`mods/common/src/trace/rules/sip-connect/`), corpus files with `profiles: [sip-connect]`,
  and the SEET compliance job's SIPconnect test cases (`sc-*`). Judge provider-facing behavior
  there against SIPconnect 1.1 first, then the RFCs it references. Everything else follows the
  RFCs alone. A deliberate deviation gets a line under Decisions.
- **The trace corpus is how Routr keeps interop.** `etc/corpus/` holds the SEET recordings
  and `interop/<far-end>/` the recordings of real calls with well-known far ends, all known-good. The
  same CI job replays every file of both through the chain on each pull request
  (`npm run compat`, the "Known-good corpus compatibility" job) and fails on drift or on new
  rule findings (`sip` and `sip-connect` profiles).
  - An interop fix adds the sanitized recording that proves it (`etc/corpus/README.md`); a
    far-end interop fix adds it under `interop/<far-end>/` (`interop/README.md`).
    Provider-facing files use `profiles: [sip-connect]`.
  - A change to wire behavior must replay the corpus clean. When a recording legitimately
    needs to change, the PR says which and why.
  - Never edit, drop or re-record a known-good file, in `etc/corpus/` or `interop/`, just to
    make a change pass.
- The Go EdgePort's known differences from Routr 2's Java EdgePort are listed in
  `internal/edgeport/README.md`.

### database-engineer

- Routr 3 runs on the Routr 2 PostgreSQL schema as it is; the schema and its migrations
  are on `main` (`mods/pgdata/schema.prisma`, `mods/pgdata/migrations`). Nothing on `v3`
  runs a migration.
- `mods/simpledata` is the file-based alternative (`config/resources`): it serves the same
  Connect gRPC services read-only (`get`, `findBy`).

### release-engineer

- Routr 2's chart (until milestone 3): `ops/charts/connect` depends on Bitnami
  `postgresql` 12.1.15 and `redis` 17.7.3. The release commit sets its `appVersion` and
  bumps its patch version (`.scripts/bump-chart.sh`); it publishes only after every image
  is on Docker Hub.
- Routr 2's chart (until milestone 3): telemetry is OTLP/HTTP, `OTEL_EXPORTER_OTLP_ENDPOINT`
  (chart: `global.otlpEndpoint`). Unset turns it off. The old `otlExporter` value is no
  longer read.

## Decisions

- 2026-10-26: Connect targets SIPconnect 1.1; the rest of Routr targets the RFCs.
- 2026-10-26: Merge pull requests one at a time; each push to main runs a release.
- 2026-10-26: Issues that can't be stated in one sentence are closed as not planned.
- 2026-10-28: One label standard across fonoster, routr and roomr (`## Labels`); kinds are native issue types; `area: nat` folded into `area: sip-core`.
- 2026-11-06: Routr 3 is Go, built on `v3`, designed in `ROUTR3.md`; Routr 2 is maintenance-only on `main`.
- 2026-11-06: The gRPC APIs in `protos/` stay wire-compatible in 3.0; `optional` on Create fields is allowed so Routr 2's defaults survive.
- 2026-11-06: Routr 3 runs on the Routr 2 database schema as it is; no migration.
- 2026-11-06: Every setting lives in `routr.yaml`, secrets as `secret://` references; no component reads an environment variable directly.
- 2026-11-06: Order of work: milestone 0, then parity, then performance; capacity numbers come from milestone 4 only.
- 2026-11-06: gRPC ports stay open during the milestones; TLS plus an API key or mTLS on the Data API is required before 3.0.0.
- 2026-11-06: `Privacy` toward a Trunk stays `none`, as Routr 2, until its own PR right after milestone 2 (a known bug, not a design).
