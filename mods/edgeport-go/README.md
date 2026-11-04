# EdgePort (Go, experimental)

A second implementation of Routr's EdgePort, the SIP transport at the edge, in Go on
[sipgo](https://github.com/emiago/sipgo) (issue
[#496](https://github.com/fonoster/routr/issues/496)). It exists to measure the Java EdgePort
(`mods/edgeport`: JAIN SIP, GraalJS) against something without the JVM. It is not the
default, it is not in the Helm chart or the compose files, and it is not kept in lockstep
with the Java EdgePort, which stays the spec.

Image: `fonoster/routr-edgeport:<version>-go-experimental` and `fonoster/routr-edgeport:go-experimental`
(`.github/workflows/edgeport-go.yaml`). `latest` and the plain version tags are the Java
EdgePort.

## Same contract

- Reads the same `edgeport.yaml` (`CONFIG_PATH`, default `/etc/routr/edgeport.yaml` in the
  image), validated by the rules of `mods/edgeport/src/config/schema.ts` and
  `assertions.ts`.
- Reads the same environment: `EXTERNAL_ADDRS`, `LOCALNETS`, `ALIASES`, `PROCESSOR_ADDR`,
  `HOSTNAME` (the EdgePort ref), `IGNORE_LOOPBACK_FROM_LOCALNETS`,
  `STRIP_SESSION_PROGRESS_SDP`, `SECURITY_CONTEXT_CLIENT_PROTOCOLS`,
  `SECURITY_CONTEXT_CLIENT_CIPHER_SUITES`, `ENABLE_HEALTHCHECKS` (`:8080/healthz`),
  `CONSOLE_PUBLISHER_ENABLED`, `NATS_PUBLISHER_*`, `LOGS_LEVEL`. `JAIN_SIP_TRACE_LEVEL`, set
  to anything, logs every SIP message sipgo reads and writes.
- Speaks the same gRPC (`mods/common/src/protos`, `processor.ProcessMessage`) with the
  field semantics of `io.routr.headers.MessageConverter`. The tests in `internal/sipconv`
  and `internal/edgeport/wire_test.go` compare it with the Java converter's own output
  (`internal/sipconv/testdata/java`, written by `testdata/FixtureDump.java`).
- Same ports, user (1000:3000), certificate handling (`convert-to-p12.sh`, PKCS12 keystore)
  and entrypoint (tini) as the Java image.

## Build and test

```bash
cd mods/edgeport-go
go test ./...                     # Go 1.24
docker build -f mods/edgeport-go/Dockerfile -t routr-edgeport:go ../..
```

The gRPC stubs in `internal/pb` are generated and committed; `scripts/protoc.sh`
regenerates them from `mods/common/src/protos`.

SEET with the Go EdgePort (the `compliance-go` job in `.github/workflows/test.yaml`):

```bash
npm run make && sh .scripts/dev-certs.sh
docker compose -f compose.yaml -f compose.dev.yaml -f mods/edgeport-go/compose.seet.yaml up --build -d
docker compose -f compose.yaml -f compose.dev.yaml -f mods/edgeport-go/compose.seet.yaml \
  up --abort-on-container-exit --exit-code-from compliance compliance
```

## How it maps to the Java EdgePort

| Java | Go |
| :--- | :--- |
| `GRPCSipListener.processRequest`, `sendRequest`, `sendResponse`, `sendCancel` | `internal/edgeport/request.go` |
| `GRPCSipListener.processResponse`, `AuthenticationHandler` | `response.go`, `auth.go` |
| `TransactionManager` | `transactions.go` |
| `MessageConverter` and the converters in `io.routr.headers` | `internal/sipconv` |
| `EventProcessor`, publishers, `HangupCauses` | `events.go` |
| JAIN SIP's stack: transactions, retransmissions, timers | sipgo's transaction layer |
| JAIN SIP's `DefaultRouter`, `received`/`rport` marking, `createResponse` | `message.go`, `edgeport.go` |
| The JAIN SIP event thread | `callqueue.go`: one queue per Call-ID, calls run concurrently |

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
