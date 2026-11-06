# EdgePort (Go)

Routr's EdgePort, the SIP transport at the edge, in Go on
[sipgo](https://github.com/emiago/sipgo). On `v3` it is the EdgePort of Routr 3 (`ROUTR3.md`
§ 3.5); the Java EdgePort it replaces (JAIN SIP, GraalJS) lives on `main` under
`mods/edgeport` and is the comparison, not a copy kept here. Started as
[#496](https://github.com/fonoster/routr/issues/496).

Image: `fonoster/routr-edgeport` (`.github/workflows/release.yaml`, built from
`cmd/edgeport/Dockerfile`). No image is published from `v3` until 3.0.0; `latest` and
the 2.x tags on Docker Hub are the Java EdgePort from `main`.

## Same contract

- Reads the same `edgeport.yaml` (`CONFIG_PATH`, default `/etc/routr/edgeport.yaml` in the
  image). `internal/common/config` carries the rules of Routr 2's `mods/edgeport/src/config/schema.ts`
  and `assertions.ts` (on `main`).
- Reads the same environment: `EXTERNAL_ADDRS`, `LOCALNETS`, `ALIASES`, `PROCESSOR_ADDR`,
  `HOSTNAME` (the EdgePort ref), `IGNORE_LOOPBACK_FROM_LOCALNETS`,
  `STRIP_SESSION_PROGRESS_SDP`, `SECURITY_CONTEXT_CLIENT_PROTOCOLS`,
  `SECURITY_CONTEXT_CLIENT_CIPHER_SUITES`, `ENABLE_HEALTHCHECKS` (`:8080/healthz`),
  `CONSOLE_PUBLISHER_ENABLED`, `NATS_PUBLISHER_*`, `LOGS_LEVEL`. `JAIN_SIP_TRACE_LEVEL`, set
  to anything, logs every SIP message sipgo reads and writes.
- Speaks the same gRPC (`protos/`, `processor.ProcessMessage`) with the
  field semantics of `io.routr.headers.MessageConverter`. The tests in `internal/common/sipconv`
  and `internal/edgeport/wire_test.go` compare it with the Java converter's own output
  (`internal/common/sipconv/testdata/java`, written on `main` by Routr 2's Java converter through
  `FixtureDump.java`; the fixtures are frozen on `v3`, so a changed fixture is a changed wire
  contract).
- Same ports, user (1000:3000), certificate handling (`convert-to-p12.sh`, PKCS12 keystore)
  and entrypoint (tini) as Routr 2's EdgePort image.
- Asks the kernel for a 4 MiB receive buffer on every UDP listening point
  (`edgeport.DefaultUDPReadBuffer`, `Options.UDPReadBuffer`): the kernel's default drops
  packets in bursts (ROUTR3.md § 1). The start log shows what the kernel granted; when it is
  less than asked, raise `net.core.rmem_max` (Linux) or `kern.ipc.maxsockbuf` (macOS).

## Build and test

```bash
go test ./...   # Go 1.26, at the repository root
docker build -f cmd/edgeport/Dockerfile -t routr-edgeport .
```

The gRPC stubs in `internal/common/pb` are generated and committed; `scripts/protoc.sh`
regenerates them from `protos/` (protoc 29.3, protoc-gen-go v1.36.6 and protoc-gen-go-grpc
v1.5.1 on PATH).

SEET with the Go EdgePort (the `compliance` job in `.github/workflows/test.yaml`):

```bash
npm ci && npm run build && sh .scripts/dev-certs.sh
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
docker compose -f compose.yaml -f compose.dev.yaml up --abort-on-container-exit --exit-code-from compliance compliance
```

## How it maps to Routr 2's Java EdgePort

| Java | Go |
| :--- | :--- |
| `GRPCSipListener.processRequest`, `sendRequest`, `sendResponse`, `sendCancel` | `internal/edgeport/request.go` |
| `GRPCSipListener.processResponse`, `AuthenticationHandler` | `internal/edgeport/response.go`, `auth.go` |
| `TransactionManager` | `internal/edgeport/transactions.go` |
| `MessageConverter` and the converters in `io.routr.headers` | `internal/common/sipconv` |
| `EventProcessor`, publishers, `HangupCauses` | `internal/edgeport/events.go` |
| JAIN SIP's stack: transactions, retransmissions, timers | sipgo's transaction layer |
| JAIN SIP's `DefaultRouter`, `received`/`rport` marking, `createResponse` | `internal/edgeport/message.go`, `edgeport.go` |
| The JAIN SIP event thread | `internal/edgeport/callqueue.go`: one queue per Call-ID, calls run concurrently |

Known differences from the Java EdgePort:

- A CANCEL that matches an INVITE transaction is answered by sipgo's transaction layer
  (200 for the CANCEL, 487 for the INVITE) before the processor is asked; the EdgePort then
  asks the processor and sends the CANCEL downstream. The Java EdgePort asks first. If the
  processor answers the CANCEL itself, that answer is not sent (the CANCEL is already
  answered).
- A 487 the stack sends carries a To tag (sipgo's); JAIN SIP sends none.
- An ACK forwarded statelessly gets a branch derived from the ACK (`z9hG4bK` + hash) where
  JAIN SIP derives a non-RFC-3261 one from the dialog fields.
- A response code `ResponseCode` doesn't list (for example 422) is relayed with
  `responseType` UNKNOWN; the Java EdgePort fails on it and drops the response.
- A flag parameter on From or To is written `;flag`; JAIN SIP writes `;flag=`.
- List headers keep one line per Via, Route and Record-Route value; JAIN SIP joins them with
  commas. Other list headers (Allow, Supported, ...) are joined as JAIN SIP joins them.
- A call to the processor times out after 30 s; the Java EdgePort waits forever.
- A server transaction that will never get a final response (the processor failed, the
  request timed out downstream) is released after 64*T1 instead of being kept.
- Not implemented: OpenTelemetry (traces, metrics, logs; `OTEL_EXPORTER_OTLP_ENDPOINT` is
  ignored), `HEPLIFY_OPTIONS`, and the WebSocket send timeouts the Java EdgePort needs to
  work around JAIN SIP.
