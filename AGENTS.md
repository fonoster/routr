# AGENTS.md

## Overview

Routr is a SIP proxy, location server and registrar for carriers, communication service
providers and integrators. It is a monorepo (npm workspaces and Lerna, `mods/*`) of Node 22
TypeScript services that talk gRPC, plus EdgePort, the SIP transport at the edge, written in
Java (JAIN SIP) and running a TypeScript bundle in GraalJS. Connect (`mods/connect`) is the
default processor. Each release ships the `@routr/*` npm packages, the `fonoster/routr-*`
Docker images and the `routr-connect` Helm chart. User docs live in `docs-site/` (Mintlify,
docs.routr.io); the design specs are `CORE.md` and `CONNECT.md`.

## Commands

- Install: `npm ci`. Not `npm install`: it drifts `@oclif/core` past the pinned version and
  breaks the `@routr/ctl` build.
- Build for tests: `npm run generate --workspace=@routr/pgdata && npx lerna run build`.
  Workspaces resolve to `dist/`, so tests need a build first.
- Full build, including the EdgePort jars and bundle: `npm run make` (needs JDK 17).
- Unit tests: `npm test` (`mods/*/test/*.unit.test.ts`). One package:
  `npx cross-env NODE_ENV=dev mocha mods/<name>/test/*.unit.test.ts`.
- Typecheck: `npm run typecheck`. Lint: `npx eslint mods --ext .ts` (`npm run lint` adds
  `--fix`).
- GraalJS bundle check: `npm run transpile && npx webpack --config webpack.config.js --mode none && npm run check:bundle`.
- Java (EdgePort, Requester): `./gradlew test` on JDK 17. Mockito 5.1.1 fails on JDK 21.
- Corpus replay: `npm run compat -- --sip-connect` (after the build).
- Not gated in CI: `npm run test:integration` (needs Redis), `npm run test:graaljs` (needs
  GraalVM), the `@routr/ctl` suite.
- CI (`.github/workflows/test.yaml`) runs on pull requests: unit, typecheck and lint;
  corpus compatibility; Java tests; SEET compliance against the full compose stack. A PR
  that touches only `docs/`, `docs-site/`, `site/`, `designs/` or Markdown skips them.
- The pre-commit hook runs `npm test`, format, lint, typecheck and `generate:readme`.

Default Verify per area:

- sip-core, nat: `npm test`, `./gradlew test` and `npm run compat -- --sip-connect`.
- interop: `npm run compat -- --sip-connect`; the SEET job on the PR.
- infra: the PR's Tests run; for the chart, `npm run helm:package`.

## Conventions

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
- EdgePort's TypeScript runs in GraalJS with no `BigInt`: check new dependencies with
  `npm run check:bundle`.
- Tests: mocha, chai, sinon, sinon-chai; files named `*.unit.test.ts` (`*.int.test.ts` for
  integration).
- Conventional commits, enforced by commitlint.

## Areas

| Area label | Paths | Experts |
| :--- | :--- | :--- |
| area: sip-core | mods/edgeport, mods/dispatcher, mods/processor, mods/location, mods/connect, mods/registry, mods/requester | realtime-comms-engineer |
| area: interop | mods/connect, mods/common/src/trace, etc/corpus, etc/scenarios | realtime-comms-engineer |
| area: nat | mods/edgeport, mods/rtprelay, mods/common/src/ip_utils.ts | realtime-comms-engineer |
| area: infra | ops/charts, Dockerfile, mods/*/Dockerfile, compose*.yaml, .github/workflows, .scripts | release-engineer, security-engineer |
| (none) | mods/pgdata, mods/simpledata | database-engineer |
| (none) | mods/ctl, mods/sdk, docs-site | technical-writer |

## Compatibility

Breaking (a major release, `!` in the commit subject):

- The gRPC APIs: `mods/common/src/protos` and `mods/common/src/connect/protos`.
- The `rctl` CLI (`mods/ctl`): commands and flags.
- The `@routr/sdk` public API.
- Env vars read at startup (`mods/*/src/envs.ts`) and the YAML config schemas
  (`mods/*/src/config/schema.ts`).
- Helm values in `ops/charts/connect/values.yaml`.
- The database schema (`mods/pgdata/schema.prisma`) when a migration can't upgrade existing
  data.
- SIP wire behavior, as replayed by the corpus in `etc/corpus`.

## Risk hotspots

- `mods/edgeport`, above all `GRPCSipListener.java`: the SIP transport; most fix commits
  land here.
- `mods/connect/src/router.ts` and `mods/connect/src/handlers`: Connect routing.
- `mods/processor/src/alterations.ts` and `mods/dispatcher/src`: every request passes
  through them.
- The EdgePort bundle: GraalJS has no `BigInt`, so a dependency that uses it crashes
  EdgePort at start.
- `mods/pgdata/migrations` and `schema.prisma`.
- `ops/charts/connect` (`values.yaml`, `templates/edgeport`) and the Dockerfiles.
- `.github/workflows/release.yaml`, `.scripts/next-release.sh`, `.scripts/bump-chart.sh`.

## Release

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

## Expert notes

### realtime-comms-engineer

- **SIPconnect 1.1 applies to Connect and what supports it, only.** Routr adopted the
  [SIPconnect 1.1 Technical Recommendation](https://www.sipforum.org/download/sipconnect-technical-recommendation-version-1-1/)
  for the Connect processor (`mods/connect`, specified in `CONNECT.md`). It also governs the
  modules where they support Connect (`mods/sdk`, `mods/pgdata`, `mods/registry`,
  `mods/ctl`) and the tooling that checks it: the `sip-connect` trace rules
  (`mods/common/src/trace/rules/sip-connect/`), corpus files with `profiles: [sip-connect]`,
  and the SEET compliance job's SIPconnect test cases (`sc-*`). Judge provider-facing behavior
  there against SIPconnect 1.1 first, then the RFCs it references. Everything else follows the
  RFCs alone. A deliberate deviation gets a line under Decisions.
- **The trace corpus is how Routr keeps interop.** `etc/corpus/` holds known-good recordings
  of real calls. CI replays every file through the chain on each pull request
  (`npm run compat`, the "Known-good corpus compatibility" job) and fails on drift or on new
  rule findings (`sip` and `sip-connect` profiles).
  - An interop fix adds the sanitized recording that proves it (`etc/corpus/README.md`).
    Provider-facing files use `profiles: [sip-connect]`.
  - A change to wire behavior must replay the corpus clean. When a recording legitimately
    needs to change, the PR says which and why.
  - Never edit, drop or re-record a known-good file just to make a change pass.

### database-engineer

- Prisma 6 on Postgres. Schema in `mods/pgdata/schema.prisma`, migrations in
  `mods/pgdata/migrations`, applied with `prisma migrate deploy` (`npm run db:migrate`).
- Migrations ship as their own image, `routr-pgdata-migrations`
  (`mods/pgdata/Dockerfile --target migrations`); the service is `--target runner`.
- `mods/simpledata` is the file-based alternative (`config/resources`): it serves the same
  Connect gRPC services read-only (`get`, `findBy`).

### release-engineer

- The chart `ops/charts/connect` depends on Bitnami `postgresql` 12.1.15 and `redis`
  17.7.3. The release commit sets its `appVersion` and bumps its patch version
  (`.scripts/bump-chart.sh`); it publishes only after every image is on Docker Hub.
- The Node service images `npm install` the `@routr/*` packages from the registry, not from
  the checkout.
- Telemetry is OTLP/HTTP: `OTEL_EXPORTER_OTLP_ENDPOINT` (chart: `global.otlpEndpoint`).
  Unset turns it off. The old `otlExporter` value is no longer read.

## Decisions

- 2026-10-26: Connect targets SIPconnect 1.1; the rest of Routr targets the RFCs.
- 2026-10-26: Merge pull requests one at a time; each push to main runs a release.
- 2026-10-26: Issues that can't be stated in one sentence are closed as not planned.
