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
- Asks the kernel for a 4 MiB receive buffer on every UDP socket
  (`edgeport.DefaultUDPReadBuffer`, `Options.UDPReadBuffer`): the kernel's default drops
  packets in bursts (ROUTR3.md § 1). The start log shows what the kernel granted; when it is
  less than asked, raise `net.core.rmem_max` (Linux) or `kern.ipc.maxsockbuf` (macOS).

## Transactions, transport and limits

Transactions are a table of state machines driven by one timer wheel (`tx_layer.go`,
`tx_server.go`, `tx_client.go`, `timer_wheel.go`), on sipgo's parser and connections. A
transaction holds no goroutine. The timers are RFC 3261's, late by at most 20 ms, never early:
A, B, D, E, F, G, H, I, J and K, plus RFC 6026's L and M.

A UDP listening point is one socket per core on Linux (`SO_REUSEPORT`, up to 8; elsewhere one
socket; a first bind without the option makes a port already in use fail with `EADDRINUSE`, so
a second instance can't join the group in silence), each with one reader, and parsing happens off the readers on workers chosen by the
hash of the Call-ID, with a bounded queue each (`udp_ingress.go`). The kernel keeps a source on
one socket and the hash keeps a call on one worker, so a call's messages from one source stay
in order; `callqueue.go` then runs each call's work in that order. Everything leaves on the
first socket. TCP, TLS, WS and WSS are sipgo's transports, read and parsed on each connection's
goroutine.

No timer depends on a peer's socket. A transaction's lock is never held over a stream write:
responses, ACKs and first requests wait in the transaction's outbox and leave with the lock
released, in order, and the wheel only ever takes the lock. A write on any of the four stream
transports gives up after 10 s, and that connection is closed: a write may have stopped in the
middle of a message. `Close` waits 5 s at most for its connections.

Every table and queue has a limit (`Options.Limits`). The answer past one is below, with a log
line every 1,000 times, `EdgePort.Overflows()` and the counter `routr.sip.overflows` by `limit`:

| Limit | Default | Past it |
| :--- | :--- | :--- |
| `udp_queue` | 4,096 datagrams per worker, one worker per core up to 16 | Dropped; SIP retransmits |
| `transactions` | 500,000 per direction | 503 to the request, stateless if the server side is what's full |
| `call_queue` | 256 per call, 262,144 over all | 503 to a request with a transaction; a response is dropped; a caller's CANCEL is never refused |
| `dialogs` | 500,000 | The oldest dialog already ended gives up what it had left of its 4 minutes; 503 to the new INVITE when every entry is live |
| `async_sends` | 256 | A 100 Trying over a stream isn't sent |

A dialog no BYE ended expires after 24 hours with no request on it (`Limits.DialogIdle`); from
then on its requests get 481, as on a restart. An INVITE client transaction in Proceeding is
released after an hour, and its caller gets a 408; nothing goes downstream. Any other server
transaction left with no final response goes after two hours. Location's per-call pins and
the Dispatcher's recorder have their own limits.

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
| JAIN SIP's stack: transactions, retransmissions, timers | `internal/edgeport/tx_*.go`, `timer_wheel.go` |
| JAIN SIP's `DefaultRouter`, `received`/`rport` marking, `createResponse` | `internal/edgeport/message.go`, `edgeport.go` |
| The JAIN SIP event thread | `internal/edgeport/callqueue.go`: one queue per Call-ID, calls run concurrently |

Known differences from the Java EdgePort:

- Any request forwarded by its Route set (a To tag, or any BYE or ACK) must be on a dialog this
  EdgePort proxied, toward one of its targets (Contacts, Record-Route), or it gets 481; an ACK
  is dropped. The Java EdgePort checked INVITE and REFER, and only that the dialog existed. The
  table is in memory: a call that outlives its EdgePort's restart, or lands on another replica
  behind one address, can't send in-dialog requests through it.
- A CANCEL that matches an INVITE transaction is answered by the transaction layer
  (200 for the CANCEL, 487 for the INVITE) before the processor is asked; the EdgePort then
  asks the processor and sends the CANCEL downstream. The Java EdgePort asks first. If the
  processor answers the CANCEL itself, that answer is not sent (the CANCEL is already
  answered).
- A 487 the stack sends carries a To tag; JAIN SIP sends none.
- The stack's 100, 487 and CANCEL 200 go where the top Via says (`received`, then `rport` or its
  port, RFC 3581), as every relayed response does. On sipgo's transaction layer the 100 and the
  487 ignored `rport` and the 200 ignored the Via's port. On a source whose port matches its
  Via, which is every recording in the corpus, nothing changes.
- An ACK to a retransmitted failure goes out at once (RFC 3261 section 17.1.1.2), and Timer K is T4
  as the RFC says, where sipgo waited T2 and 32 s. A final response handed to a Completed
  INVITE server transaction (a 2xx crossing a CANCEL) is dropped; sipgo retransmitted it on the
  next Timer G.
- A 2xx that crossed a CANCEL, whose caller already has its 487, gets an ACK and one BYE from the
  EdgePort, to its Contact and the Record-Route past this hop, so the callee's leg doesn't stay
  up for a trunk to bill. The processor doesn't see the 2xx. A re-INVITE's gets the ACK alone: its
  dialog stands. A BYE challenged by the far end isn't retried.
- With no final response from the next hop, the EdgePort answers: 408 to an INVITE whose client
  transaction timed out, 503 to any request whose next hop failed on transport, connect or DNS,
  and 503 to a request whose processor call failed with no routing decision (`NotFound` stays
  501). All carry a To tag. A non-INVITE that timed out gets nothing (RFC 4320 section 4.2). The
  Java EdgePort answered none of these.
- A CANCEL is held until the INVITE's first provisional and discarded on a final response or
  Timer B (RFC 3261 section 9.1). It goes on the INVITE's connection to the address the INVITE was
  sent to, with no second DNS lookup.
- A stray response to anything but an INVITE isn't relayed (RFC 4320 section 4.2).
- A request with no From tag and no RFC 3261 branch is matched with an empty tag (RFC 3261 section
  12.1.1), not answered 400, and an ACK that can't be matched is never answered.
- Past a limit in the table above the EdgePort answers 503 or drops; JAIN SIP's stack has no
  such limits.
- An established dialog is forgotten after 24 idle hours, a Proceeding INVITE after one. JAIN
  SIP keeps both as long as the process lives.
- An ACK forwarded statelessly gets a branch derived from the ACK (`z9hG4bK` + hash) where
  JAIN SIP derives a non-RFC-3261 one from the dialog fields.
- A response code `ResponseCode` doesn't list (for example 422) is relayed with
  `responseType` UNKNOWN; the Java EdgePort fails on it and drops the response.
- A flag parameter on From or To is written `;flag`; JAIN SIP writes `;flag=`.
- List headers keep one line per Via, Route and Record-Route value; JAIN SIP joins them with
  commas. Other list headers (Allow, Supported, ...) are joined as JAIN SIP joins them.
- A call to the processor times out after 30 s; the Java EdgePort waits forever. Within those
  30 s a call waits for the processor connection to come up (gRPC's WaitForReady), so a
  Dispatcher that is still starting, or a dial that failed and is backing off, costs requests
  a delay and not a 503.
- A server transaction that will never get a final response (a non-INVITE that timed out
  downstream, a processor that gave no usable answer) is released after 64*T1 instead of being
  kept.
- OpenTelemetry comes from the `telemetry` key of `edgeport.yaml` (`otlpEndpoint`, and
  `sampleRatio`, which replaces `OTEL_TRACES_SAMPLER`), not from the `OTEL_*` variables: write
  `otlpEndpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT:-}` to keep using that one. Unset is off and costs
  the message path a nil check. The signals are the Java EdgePort's: the span per SIP server
  transaction (`traceparent` honored from and sent to the `localnets` only, and removed from a
  request to anywhere else, with telemetry on or off), the logs, and the counters
  `routr.sip.requests`, `routr.sip.responses`, `routr.sip.timeouts` and
  `routr.sip.transport_errors`. A method SIP doesn't define counts as `other`.
  `routr.sip.send_dropped` isn't exported: what it counted are JAIN SIP's send failures. A span
  of a CANCEL or an ACK ends as soon as it starts. Requests' gRPC calls carry the span's context.
- Not implemented: `HEPLIFY_OPTIONS`, and the WebSocket send timeouts the Java EdgePort needs to
  work around JAIN SIP.
