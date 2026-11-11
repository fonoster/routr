# perf

Routr's benchmark definitions for [perfkit](https://github.com/fonoster/perfkit). perfkit
creates two DigitalOcean droplets, runs these benchmarks against a released Routr version
and writes a report. The Benchmarks workflow publishes the report to
https://routr.io/benchmarks only for `perfkit.yaml`; a smoke or calibration run stops before
the publish job and leaves its report in the run's `perfkit-report-<run id>` artifact.

How to run them, from a laptop or from GitHub: [Run a benchmark](https://docs.routr.io/guides/run-a-benchmark)
(`docs-site/guides/run-a-benchmark.mdx`).

## Map

| Path | What it is |
| --- | --- |
| `perfkit.yaml` | The full run, the only config that publishes: six benchmarks in one run of about 3.5 hours. On one c-8 server, over UDP: EdgePort + Echo, RoutrOne simple calls and RoutrOne call mix (capacity), then a 2-hour RoutrOne soak. On DOKS (3 × c-8, the Connect chart behind a Network Load Balancer), over TCP: simple calls (capacity) and a 2-hour soak. Each soak runs at half of its capacity benchmark's limit (`rate.fromCapacity`), with 2-minute calls; both soaks run at the same time. |
| `perfkit.calibration.yaml` | The EdgePort ramp with a 1-hour soak, for tuning. Doesn't publish. |
| `perfkit.smoke.yaml` | The six benchmarks of `perfkit.yaml`, shortened and on a small cluster, to check the harness in under an hour. Doesn't publish. |
| `perfkit.local.yaml` | `perfkit run --local` only: the same six on this machine's Docker and kind (with MetalLB), with this checkout's images. See [Run locally](#run-locally). |
| `history/` | The reports of the first six published runs, kept when the site was cleared ([README](history/README.md)). They measure Routr 2. |
| `logo.svg` | The "routr." wordmark on the report page (dark), from the Logo component in the design. The letters are #FFFFFF, not `currentColor`, because perfkit embeds the logo as an `<img>`; the dot is #5FCFCE. |
| `gen_resources.js` | Writes the Domain, Agents and Credentials the files backend reads, from a benchmark's SIPp users files. |
| `edgeport-echo/compose.yaml` | The Go EdgePort and Echo on the UUT droplet, host networking. Echo binds `127.0.0.1:51904`. |
| `edgeport-echo/edgeport.yaml` | EdgePort config: processor `127.0.0.1:51904`, UDP and TCP on 5060, the health check on 8080. Its addresses come from the `PERFKIT_UUT_IP` and `PERFKIT_VPC_CIDR` variables the compose file passes, through placeholders. |
| `edgeport-echo/uac_message.xml` | SIPp UAC: SIP MESSAGE, then 200 (`start_rtd`/`rtd`). |
| `one-soak/compose.yaml`, `routr.yaml` | RoutrOne on the UUT droplet, host networking, the files backend, no RTPEngine. |
| `one-soak/resources/` | The Domain `bench.routr.local` and 400 Agents with Credentials, from `gen_resources.js`. |
| `one-soak/callees.csv`, `callers.csv` | SIPp users files: `calleeNNNN;bench-pass-NNNN;<auth>` and `callerNNNN;bench-pass-NNNN;calleeNNNN;<auth>`. Caller N dials callee N. `<auth>` is the row's ready-made `[authentication username=… password=…]` keyword, because SIPp 3.7 doesn't expand `[field0]` inside `[authentication …]`. |
| `one-soak/uac_register.xml` | Keeps each callee registered: REGISTER with digest auth, Contact at the UAS port, refresh every `[refresh_ms]`. |
| `one-soak/uas_answer.xml` | The callees: answers INVITE with 100, 180, 200, then the BYE with 200. |
| `one-soak/uac_invite.xml` | The callers: authenticated INVITE, 200, ACK, hold, BYE, 200, following `[routes]`. |
| `one-mix/` | The realistic mix for `perfkit.local.yaml`: 60% answered, 15% busy, 15% cancelled, 10% offline, 1,800 registered callees. `resources/` is generated and not committed. |
| `local/` | The compose and Routr config files of `perfkit.local.yaml`, and `k8s.values.yaml`, the chart values for kind. |
| `k8s/values.yaml` | The Connect chart's values on DOKS: TCP only (DigitalOcean's load balancer drops UDP datagrams over 1,424 bytes), `externalTrafficPolicy: Local`, one EdgePort per node (three), three replicas each of Connect and the Data API, CPU requests sized for ~1,000 calls/s, images at the release under test. |
| `k8s/values.smoke.yaml` | The same for `perfkit.smoke.yaml`'s two c-4 nodes: two EdgePorts, the chart's default replicas and requests. |
| `k8s/seed.sh` | Seeds the chart's Postgres with the Domain, Credentials and Agents of the benchmark's users files; perfkit runs it after the chart is Ready. |

The compose files read the variables perfkit sets on the UUT droplet: `PERFKIT_IMAGE_<NAME>`
(digest-pinned), `PERFKIT_UUT_IP`, `PERFKIT_VPC_CIDR`, `PERFKIT_OTLP_ENDPOINT`,
`PERFKIT_TRACE_RATIO` and `PERFKIT_TARGET_VERSION`. Every service uses `network_mode: host`,
which perfkit requires.

## Check a benchmark by hand

With Docker on a machine where nothing else holds port 5060, start a UUT and drive it with SIPp 3.7. For example, EdgePort + Echo:

```bash
cd perf
export PERFKIT_IMAGE_EDGEPORT=routr-edgeport:local   # a local build of cmd/edgeport/Dockerfile
export PERFKIT_IMAGE_ECHO=fonoster/routr-echo:3.0.0-alpha.6-go   # the Go Echo; without -go it is the Node one
export PERFKIT_UUT_IP=127.0.0.1
docker compose -f edgeport-echo/compose.yaml up -d --wait
sipp 127.0.0.1:5060 -sf edgeport-echo/uac_message.xml -p 5080 -t u1 -r 10 -m 100
docker compose -f edgeport-echo/compose.yaml down
```

## Run locally

`perfkit run --local` uses this machine's Docker, with no droplets and no token. Its numbers
aren't comparable with a real run: SIPp is amd64 only and runs emulated on arm64, there is one
SIPp per role, and the server and the generator share a machine. Never publish them.

**The report names the wrong image, on purpose.** perfkit resolves every image on Docker Hub and
rejects a local one, so `images:` in `perfkit.local.yaml` names a tag that exists there, and
`--target-version` picks it. The compose files in `local/` ignore that and run
`routr-one:m4-load` and `routr-edgeport:m4-load`. To see what ran, read the process's binary, not
the report. Echo is the Hub image, the Go one (`routr-echo:<version>-go`), which exists from
`3.0.0-alpha.6` on: an earlier `--target-version` finds no Echo.

Everything shares the Docker VM's host network, with whatever else runs there, so SIP is on 5090,
health on 18080, and no gRPC service listens. perfkit's UDP counters are VM-wide on a local run
and can't separate Routr's drops from SIPp's: read `Drops` of each port in `/proc/net/udp`.

```bash
node perf/gen_resources.js perf/one-mix register.csv callers.csv
# Build linux binaries of cmd/routr-one and cmd/edgeport into images with those two tags, then:
npx -y npm@11 exec --yes --package=github:fonoster/perfkit#v0.2.0-rc.5 -- perfkit run --local \
  --config perf/perfkit.local.yaml --target-version 3.0.0-alpha.6 --benchmarks one-mix --live-port 18787
```

## perfkit version

perfkit is pinned to the git tag `v0.2.0-rc.5` in `.github/workflows/benchmarks.yaml` (every
`github:fonoster/perfkit#v0.2.0-rc.5` and `run.yaml@v0.2.0-rc.5`) and in the guide's commands. To move
to a new tag, change all of them in one pull request, then run `perfkit validate` with the new
tag on every config file:

```bash
npx -y github:fonoster/perfkit#vX.Y.Z validate perf/perfkit.yaml
npx -y github:fonoster/perfkit#vX.Y.Z validate perf/perfkit.calibration.yaml
npx -y github:fonoster/perfkit#vX.Y.Z validate perf/perfkit.smoke.yaml
npx -y github:fonoster/perfkit#vX.Y.Z validate perf/perfkit.local.yaml
```

`npx` with a git tag needs npm 11. With npm 10, the npm that Node 22 ships with, run
`npx -y npm@11 exec --yes --package=github:fonoster/perfkit#vX.Y.Z -- perfkit …`.
