# Routr 3

### Design, version 0.1 (draft for approval)

Routr 3 is Routr rewritten in Go. It keeps the architecture, the gRPC contracts, the SIP
behavior and the data of Routr 2, and replaces the Node and Java implementations with one
language, one binary for RoutrOne, and a call path designed from what profiling Routr 2
taught us. `CORE.md` and `CONNECT.md` remain the behavior specifications; this document
says what changes underneath them and how the work is run.

Routr 2 is in maintenance mode: fixes only, on `main`. Routr 3 is built on the `v3` branch,
which becomes `main` at 3.0.0.

## 1. Decisions

Settled on 2026-11-06. Each one is a constraint on every issue below.

| Decision | Choice |
| :--- | :--- |
| Language | Go for every component. The SDK (`@routr/sdk`) and `rctl` stay in TypeScript; processors can be written in Go (new SDK) or Node (the existing `@routr/processor` contract). |
| Scope of 3.0 | Full Connect parity with Routr 2: everything `CONNECT.md` covers, RTPRelay, call recording and Connect Tokens included. |
| Compatibility | The gRPC APIs (`protos/`) stay wire-compatible (`optional` was added on a few Create fields so defaults survive), so `rctl`, the SDK and existing processors keep working. SIP wire behavior is proven by the corpus (`etc/corpus`, `interop/`) and SEET, as today. |
| Data | Routr 3 runs on a Routr 2 PostgreSQL database as it is: same schema, same Cloak-encrypted passwords, no migration. Upgrading is swapping binaries. The file-based YAML resources (today's simpledata) stay as the second, read-only backend. |
| Location | Memory in RoutrOne and single-instance runs; Redis when instances share bindings, with an indexed key layout (#511), never a keyspace scan. |
| Configuration | One YAML format. RoutrOne reads `routr.yaml`, one section per component; a standalone component reads its section from its own file. Shapes stay Routr 2's where they exist (`kind: EdgePort`, `spec.transport`, `one.yaml`'s `spec.connect`) with `apiVersion: v3`. Every setting lives in the file, secrets included: a value is a literal, a `${VAR}` placeholder or a `secret://` reference (`env`, `file`, `k8s`), the mechanism Routr 2.31 and Fonoster already use. No environment variable is read directly, `DATABASE_URL` and `CLOAK_ENCRYPTION_KEY` included. |
| Order of work | The Java EdgePort, Prisma and GraalJS leave `v3` first, before any Go component lands. Then parity, then performance. The capacity numbers Routr 3 claims come from the performance phase, not from the prototype. |
| Process | This document first; then one psstack issue per component or slice, reported, implemented, reviewed and merged into `v3` by the agents, with the maintainer reading Briefs and this spec. |

## 2. What Routr 2 taught us

Measured on an M4 Pro (8 cores to the device under test), 1,800 registered Agents, the
realistic call mix (60% answered, 15% busy, 15% cancelled, 10% offline). The numbers are in
the owner's `.perf-notes/2026-11-05-kamailio-reference/` and the issue #539 thread.

| Finding | Evidence | Consequence for Routr 3 |
| :--- | :--- | :--- |
| The data layer was the first wall, and it was Prisma, not Postgres. | `Agents.FindBy`: 453 req/s on Prisma, 23,893 req/s from Go with the same four queries and byte-identical answers. | pgx, hand-written queries, the same tables. |
| Lookups are a design cost, not a database cost. | 30 transactions per call; 14 of them before the `401` every first INVITE gets. The cache took RoutrOne 2 from 66 to 160 calls/s; 200 in the best run. | Challenge first, then one lookup plan per call that touches each resource once. A read cache inside RoutrOne with write invalidation. |
| Converting the whole message at every hop is the top allocator. | Heap profiles of the Go prototype: sipgo parsing and `sipconv.*FromDTO` lead; GC took 10–14% of CPU. | The parsed SIP message is the in-process model. The protobuf DTO exists only at the gRPC boundary. |
| A goroutine per transaction is Routr 2's listener model copied over. | 172,000 goroutines at 1,900 calls/s; RSS peaks of 5–8.6 GB; memory scales with in-flight transactions, which outlive the call by SIP's timers. | A transaction table and timer wheel. Deferred to the performance phase by decision; the design must not make it harder. |
| One global scan per ended transaction capped the prototype. | Fixing `RemoveServerTransaction` took it from 720 to 2,000 calls/s. | Every per-transaction operation is O(1). |
| One UDP read loop that parses inline, with the kernel's default buffer, was the next wall. | Drops on Routr's socket at 2,500 calls/s; a 4 MB buffer removed them; the reader was still single. | Several readers per socket (`SO_REUSEPORT`), parse off the read loop, sized buffers. |
| Direct calls halve CPU without changing the contract. | 5.5 → 2.9 cores at 2,000 calls/s. | RoutrOne calls components through the same interfaces a gRPC client implements. |
| Per-process CPU per call is already OpenSIPS-class with the cache. | 1.2 cores at 2,500 calls/s ≈ 0.5 ms per call; OpenSIPS 3.4 with auth caching: 0.5–0.9 ms. | The remaining gap is throughput ceiling and memory, not per-call CPU. |
| The load generator lies first. | One SIPp instance caps near 2,000 calls/s and drops before Routr does. | Capacity runs use several SIPp pairs and report drops on both sides. |
| Security gaps that rode along with the design. | Agent-to-Peer calls skipped the digest check; nonces never expired; an unknown AOR answered 500 on its second lookup. | Fixed in 2.32.3; Routr 3 starts with them fixed and tested. |

## 3. Architecture

Unchanged in shape, so `CORE.md` still describes it: EdgePort, Message Dispatcher,
Processors (Connect is the default), Location, the Data API, Registry, RTPRelay, Requester.
Each is a Go package under `mods/` with its own `main` and container image, and RoutrOne
links them into one binary.

```
                 SIP                     gRPC ProcessMessage
  endpoints  <────────>  EdgePort  ───────────────────────>  Dispatcher ──> Connect ──> Location
                                                                 │             │
                                                                 │             └──> Data API ──> PostgreSQL | YAML files
                                                                 └──> middlewares (RTPRelay), external processors (Go or Node)
```

### 3.1 Interfaces, in process or over gRPC

Every component exposes one Go interface shaped exactly like its gRPC client. A gRPC client
implements it; so does the component itself. RoutrOne wires the components directly;
anything else dials. The contract is the same either way, so a processor written against
the gRPC API behaves identically inside RoutrOne.

Rule: a direct call shares memory where gRPC copied it. A component never mutates a message
it received; it returns a new one or a decision.

### 3.2 The message model

`sip.Message` (the parsed message of the SIP stack) is what flows between EdgePort,
Dispatcher and Connect in process. The `MessageRequest`/`MessageResponse` protobufs are
produced and consumed only at a gRPC boundary: an external processor, a middleware, or a
component running on its own. The converter lives in one package (`mods/common/sipconv`)
with the Java converter's field semantics and the fixture tests the prototype already has.

### 3.3 Connect's call path

1. In-dialog requests (a To tag) are forwarded on their route set; no lookups.
2. An out-of-dialog INVITE without credentials from a host that is no Trunk's `inboundUri`
   and without `X-Connect-Token` is challenged before any other lookup.
3. A routed call makes one plan: the resources it needs (caller, callee, Trunk, Domain,
   Number) each fetched once, through the Data API interface, in parallel where
   independent.
4. Access checks cover every direction `CONNECT.md` defines, Agent ↔ Peer included.
5. Nonces carry their issue time and expire (`nonceMaxAge`, default 300 s; `0` for replays).

### 3.4 Data API

Postgres through pgx on the Routr 2 schema, with the same query shapes the mappers use
today (includes become explicit joins or second queries, measured per resource). The
file-based backend serves the same read-only `FindBy`/`Get`/`List` from YAML resources. Cloak
field encryption is read and written in the same format as Routr 2, so passwords stored by
either version work in both.

RoutrOne holds a read cache in front of the Data API interface: keyed by kind, field and
value, TTL with spread, one load per key, invalidated by writes through the API (the written
row and every kind that embeds it). A separate Data API process has no cache; the chart's
multi-replica case stays correct by construction.

### 3.5 EdgePort

The Go EdgePort from `mods/edgeport-go` is the starting point: same `edgeport.yaml`, same
converter semantics, same events. Three things change on the way to 3.0, in this order:
the fixes already measured (the transaction scan, the socket buffer), the in-process
interface to the Dispatcher, and, in the performance phase, the transaction table and the
multi-reader transport.

### 3.6 Location

The same gRPC service. Per-call entries live seconds, not a registration. The Redis store
keeps the binding key names Routr 2 writes (a rollout mixes versions) and adds the sorted-set
index #511 specifies.

### 3.7 Configuration

```yaml
# routr.yaml: RoutrOne reads every section; a standalone component reads its own
apiVersion: v3
kind: Routr
logLevel: info                       # debug, info, warn or error
spec:
  edgeport:        # the EdgePort spec of Routr 2's edgeport.yaml, unchanged
    externalAddrs: [203.0.113.10]
    localnets: [10.0.0.0/8]
    transport:
      - { protocol: udp, port: 5060 }
      - { protocol: tcp, port: 5060 }
    securityContext:
      keyStorePassword: secret://k8s/routr-tls#password
  dispatcher:
    bindAddr: 0.0.0.0:51901          # every component section takes one: its gRPC
  connect:                           # listener, the Routr 2 port by default, "" for off
    nonceMaxAge: 300
    registerDefaultExpires: 3600
    # verifierAddr: verifier:51905   # or verifierPublicKeyPath: /etc/routr/key.pem
    # untrustedHeadersToStrip: []    # absent is the default list, empty strips nothing
  location:
    cache: { provider: memory }      # or redis, with parameters below
  data:
    backend: postgres                # or files, path: /etc/routr/resources
    url: secret://env/DATABASE_URL   # a literal works too; so does ${DATABASE_URL}
    encryptionKey: secret://file/var/run/routr/secrets/cloak
  rtprelay:
    host: rtpengine
    port: 22222
  requester:
    bindAddr: 0.0.0.0:51909
    sipHost: 10.0.0.5                # bound, and written in Via and Contact; the local IP if absent
  registry:                          # absent: no periodic REGISTER
    registerInterval: 60
    methods: [INVITE, MESSAGE]       # the REGISTER's Allow headers
    edgePorts:                       # required: the first one is the way out
      - { address: 127.0.0.1:5060 }
```

In RoutrOne the Registry calls the Requester in process and reads its Trunks through the
cached Data API client; the Requester's `bindAddr` only decides whether it is also served
over gRPC. Standalone, `cmd/registry` and `cmd/requester` keep Routr 2's `registry.yaml` and
a small `requester.yaml`, and `cmd/connect` takes the same Connect keys in `connect.yaml`.

Secrets are configuration like everything else. A value is a literal, a `${VAR}` or
`${VAR:-default}` placeholder, or a `secret://` reference: `secret://env/NAME`,
`secret://file/<path>`, `secret://k8s/[<namespace>/]<secret>#<key>` (a mounted Kubernetes
Secret). That is the mechanism `one.yaml` resolves today (`mods/common/src/config`) and
Fonoster uses; Routr 3 ports it to Go unchanged. No component reads an environment variable
on its own: an operator who wants `DATABASE_URL` writes `url: secret://env/DATABASE_URL`.
Errors name the key and the reference, never the value.

### 3.8 Packaging

- `fonoster/routr-one:3.x`: one static binary, also attached to the GitHub release for
  linux/amd64, linux/arm64 and darwin/arm64.
- One image per component with the Routr 2 names (`fonoster/routr-edgeport`,
  `-dispatcher`, `-connect`, `-location`, `-pgdata`, `-registry`, `-rtprelay`,
  `-requester`), 3.x tags.
- The Helm chart `routr-connect` keeps its values where the component keeps the setting;
  the per-component env lists become config files mounted from the values.
- `@routr/sdk`, `@routr/ctl` and `@routr/processor` move to 3.x in lockstep and keep their
  APIs.

## 4. Repository layout on `v3`

Go and TypeScript never share a directory, so a Go `common` can't collide with
`@routr/common`:

```
go.mod                      one module: github.com/fonoster/routr
protos/                     the gRPC contracts, the single source for both languages
cmd/                        one main per binary: routr-one, edgeport, dispatcher, connect,
                            location, data, registry, rtprelay, requester
internal/common/            Go shared code: pb (generated), sipconv, config, secrets, cloak
internal/edgeport/          from mods/edgeport-go
internal/dispatcher/ internal/connect/ internal/location/ internal/data/
internal/registry/ internal/rtprelay/ internal/requester/
internal/one/               RoutrOne: wiring, routr.yaml, the cache
mods/                       TypeScript only: common, sdk, ctl, processor (npm workspaces)
etc/corpus/ interop/ etc/scenarios/   unchanged: the proofs
ops/ docs-site/ perf/       as today
```

`@routr/common` keeps serving the protos to the TypeScript packages by copying them from
`protos/` at build time; nothing in the SDK, `rctl` or a Node processor changes.

The Java EdgePort, the Java Requester, Prisma (pgdata), GraalJS (the bundle, `transpile`,
`check:bundle`, webpack) and Gradle leave `v3` in milestone 0, before any Go component
lands. The Node services (dispatcher, connect, location, simpledata, registry, rtprelay,
one) leave as each Go component replaces them. Routr 2 on `main` is the comparison, not a
copy kept on `v3`.

## 5. Conventions for Go

- `gofmt`, `go vet`, `go test -race ./...`; the MIT header as a Go comment.
- One package per component; a component's public surface is its interface and its
  `New` constructor; everything else is `internal`.
- No goroutine without an owner that stops it; no global mutable state outside the
  component's struct.
- Every per-message or per-transaction operation is O(1); a scan is a bug.
- Errors are values with context; a failed lookup is a SIP answer, never a crash.
- Tests: a unit test per function with the validation-failure case; wire tests against the
  Java converter fixtures; the corpus replay and SEET in CI for every PR.

## 6. Milestones

Each milestone is one or more psstack issues on `v3`; the gate is the proof named.

| # | Milestone | Proof |
| :--- | :--- | :--- |
| 0 | **Clear the ground:** remove the Java EdgePort, the Java Requester, Prisma, GraalJS and Gradle from `v3`; move `mods/edgeport-go` to `cmd/edgeport` + `internal/edgeport`; `protos/` as the single source; `go.mod` at the root; the Go CI job replaces the Java ones; AGENTS.md rewritten for v3. | The compose stack and SEET run on the Go EdgePort against the Node services with the file-based data backend (Routr 2's published Requester image keeps the registration scenarios green); `npm test` and `go test ./...` pass; no `.java`, `.gradle` or Prisma file remains, the Java converter's frozen fixtures excepted. |
| 1 | **Skeleton:** `internal/common` (stubs, sipconv, config with placeholders and `secret://`, cloak), the EdgePort's two measured fixes, Dispatcher, Location (memory), Data API (Postgres + files, reads), Connect agent-to-agent, the RoutrOne binary reading `routr.yaml`. | Corpus replay and SEET pass for the agent-to-agent scenarios; `rctl` and the SDK read through the Go Data API. |
| 2 | **Connect parity:** Trunks, Numbers, from-PSTN, agent-to-PSTN, peer-to-PSTN, ACLs, trunk identity, normalization, Connect Tokens; Data API writes with invalidation; Registry and Requester (SEET's registration scenarios need the trunk REGISTER they send; until then the compliance stack runs Routr 2's published Requester image). | Every corpus and interop recording replays clean; SEET fully green. |
| 3 | **Operations parity:** Redis Location, RTPRelay, call recording and the trace rules, telemetry (OTLP), health checks, images, chart, release workflow. | The chart installs and passes SEET on kind; `rctl trace` works against RoutrOne 3. |
| 4 | **Performance:** transaction table and timer wheel, multi-reader transport, bounded memory, the cache's final shape. | Realistic mix, 30 s calls, 15 minutes, several load generators: the number goes on routr.io/benchmarks. |
| 5 | **3.0.0:** TLS plus an API key or mTLS on the Data API; docs (`docs-site`) for the new config, the upgrade guide (swap binaries, keep the database), `v3` becomes `main`. | A Routr 2 deployment upgrades to 3.0 without a migration and passes its own SEET. |

Milestone 4 is where capacity claims come from. Until then Routr 3 is "the Go rewrite that
passes the same proofs", not "the fast one".

## 7. Out of scope for 3.0

A new database schema; a shared cache across Data API replicas; nonce-count tracking;
Kamailio-style script configuration; replacing `rctl` or the SDK; reading any setting or
secret from the environment without a reference in `routr.yaml`.
