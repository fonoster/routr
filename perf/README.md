# perf

Routr's benchmark definitions for [perfkit](https://github.com/fonoster/perfkit). perfkit
creates two DigitalOcean droplets, runs these benchmarks against a released Routr version
and writes a report that the Benchmarks workflow publishes to https://routr.io/benchmarks.

How to run them, from a laptop or from GitHub: [Run a benchmark](https://docs.routr.io/guides/run-a-benchmark)
(`docs-site/guides/run-a-benchmark.mdx`).

## Map

| Path | What it is |
| --- | --- |
| `perfkit.yaml` | The full run: the project, the droplets, the images and both benchmarks (`apiVersion: perfkit/v1`). |
| `perfkit.smoke.yaml` | The same benchmarks, shortened (EdgePort ramp up to 300 messages/s, a 3-minute soak at 10 calls/s), to check the harness and the page in under an hour. |
| `logo.svg` | The "routr." wordmark on the report page (dark), from the Logo component in the design. The letters are #FFFFFF, not `currentColor`, because perfkit embeds the logo as an `<img>`; the dot is #5FCFCE. |
| `edgeport-echo/compose.yaml` | EdgePort and Echo on the UUT droplet, host networking. Echo binds `127.0.0.1:51904`. |
| `edgeport-echo/edgeport.yaml` | EdgePort config: processor `127.0.0.1:51904`, UDP and TCP on 5060. Its addresses come from `EXTERNAL_ADDRS` and `LOCALNETS` in the compose file, because the config loader doesn't expand variables. |
| `edgeport-echo/uac_message.xml` | SIPp UAC: SIP MESSAGE, then 200 (`start_rtd`/`rtd`). |
| `one-soak/compose.yaml` | routr-one on the UUT droplet, host networking, internal PostgreSQL, no RTPEngine. |
| `one-soak/seed.js` | Runs once the UUT is up: installs `@routr/sdk@$PERFKIT_TARGET_VERSION` and creates the Domain `bench.routr.local` and 400 Agents with Credentials. |
| `one-soak/callees.csv`, `callers.csv` | SIPp users files: `calleeNNNN;bench-pass-NNNN;<auth>` and `callerNNNN;bench-pass-NNNN;calleeNNNN;<auth>`. Caller N dials callee N. `<auth>` is the row's ready-made `[authentication username=… password=…]` keyword, because SIPp 3.7 doesn't expand `[field0]` inside `[authentication …]`. |
| `one-soak/uac_register.xml` | Keeps each callee registered: REGISTER with digest auth, Contact at the UAS port, refresh every `[refresh_ms]`. |
| `one-soak/uas_answer.xml` | The callees: answers INVITE with 100, 180, 200, then the BYE with 200. |
| `one-soak/uac_invite.xml` | The callers: authenticated INVITE, 200, ACK, hold, BYE, 200, following `[routes]`. |

The compose files read the variables perfkit sets on the UUT droplet: `PERFKIT_IMAGE_<NAME>`
(digest-pinned), `PERFKIT_UUT_IP`, `PERFKIT_VPC_CIDR`, `PERFKIT_OTLP_ENDPOINT`,
`PERFKIT_TRACE_RATIO` and `PERFKIT_TARGET_VERSION`. Every service uses `network_mode: host`,
which perfkit requires.

## Check a benchmark by hand

With Docker on a machine where nothing else holds port 5060, start a UUT with released images
and drive it with SIPp 3.7. For example, EdgePort + Echo:

```bash
cd perf
export PERFKIT_IMAGE_EDGEPORT=fonoster/routr-edgeport:2.31.6
export PERFKIT_IMAGE_ECHO=fonoster/routr-echo:2.31.6
export PERFKIT_UUT_IP=127.0.0.1
docker compose -f edgeport-echo/compose.yaml up -d --wait
sipp 127.0.0.1:5060 -sf edgeport-echo/uac_message.xml -p 5080 -t u1 -r 10 -m 100
docker compose -f edgeport-echo/compose.yaml down
```

## perfkit version

perfkit is pinned to the git tag `v0.1.2` in `.github/workflows/benchmarks.yaml` (every
`github:fonoster/perfkit#v0.1.2` and `run.yaml@v0.1.2`) and in the guide's commands. To move
to a new tag, change all of them in one pull request, then run `perfkit validate` with the new
tag on both config files:

```bash
npx -y github:fonoster/perfkit#vX.Y.Z validate perf/perfkit.yaml
npx -y github:fonoster/perfkit#vX.Y.Z validate perf/perfkit.smoke.yaml
```

`npx` with a git tag needs npm 11. With npm 10, the npm that Node 22 ships with, run
`npx -y npm@11 exec --yes --package=github:fonoster/perfkit#vX.Y.Z -- perfkit …`.
