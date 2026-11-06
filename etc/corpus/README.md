# SEET fixtures and shared replay resources

The SEET compliance recordings, calls that behaved as they should, replayed
through the chain on every pull request, and `resources/`, the Trunks, Numbers,
Agents and Credentials every replay uses. Far-end recordings go to
`interop/<far-end>/` with that folder's `manifest.yaml` (see
[interop/README.md](../../interop/README.md)), while `resources/` stays here for
every replay. `npm run compat` starts simpledata, location, connect and
the dispatcher from this checkout (no EdgePort, no Docker), sends every
recorded message of every file in `manifest.yaml` to the dispatcher, and fails
when the chain answers differently today (drift) or when a file no longer
passes its rule profiles. The unit suite also checks every file here: that it
is listed, named right, valid, and free of findings.

The dispatcher reads the SIP messages from the files, so a recording made
against any Routr deployment replays here as long as the resources it touches
exist in `resources/`. Replay goes from the request as the EdgePort received
it to the answer the chain returned; Via branches, From and To tags and digest
nonces differ between runs by design and never count as drift. Timing is never
compared.

## File names

`<origin>_<flow>_<far-end>_<YYYYMMDD>.jsonl`, lowercase. Underscores separate
the four fields; use hyphens inside a field.

| Field | Meaning | Examples |
| --- | --- | --- |
| origin | who sent the first message | `seet`, `zoiper`, `linphone`, `sipjs`, `twilio` |
| flow | what happened | `dod-invite`, `did-invite`, `register`, `blind-transfer`, `sc-1.3.2-did` |
| far-end | who was on the other side | `seet`, `twilio`, `telnyx`, `voipms`, `routr` |
| date | when it was recorded | `20261023` |

## Adding a known-good

1. Take the file from the `call-recordings` artifact of a compliance run (the
   dev stack records every call, unredacted, with `config/dispatcher.dev.yaml`),
   or from your own stack with `recording.redact: false`.
2. Sanitize it so it can be committed and still replays:

   ```bash
   rctl trace sanitize <file> \
     --credentials etc/corpus/resources/credentials.yaml \
     --keep-host wa.meta.vc \
     --rewrite +13055550100=+15555550100 \
     --rewrite sip.realprovider.net=sip.provider.net \
     --out interop/twilio/zoiper_dod-invite_twilio_20261101.jsonl
   ```

   By default every value that is not protocol structure gets a fake, and a value
   keeps the same fake across the file, so dialogs stay consistent: numbers and
   numeric ids of 7 or more digits become `+1555555xxxx`, addresses `10.0.0.x`
   (private) or `203.0.113.x` (public), hosts `*.invalid`. Call-IDs, tags,
   branches, nonces, refs, display names, non-numeric SIP users, the values of
   `X-`, `P-`, `Remote-Party-ID`, `Diversion` and any header that isn't protocol,
   and the SDP `o=`, `s=`, ICE, fingerprint, crypto, cname, msid and ssrc values
   are replaced too. Method, status, transport, timing, schema fields, `CSeq`,
   `Allow`, `Supported`, `User-Agent`, `Server`, other protocol headers such as
   `Content-Type`, the digest structure and algorithm, and the RFC 3323 anonymous
   identity (`Anonymous`, `anonymous`, `anonymous.invalid`) stay. In an address
   header, parameters keep their value only when it is a protocol value, such as
   `user=phone` or `reason=busy`, and any text the command doesn't recognize is
   replaced.

   Two flags keep a recording replayable against `resources/`. `--keep-host`
   keeps a host or an address as it is. `--rewrite` chooses the fake of a value:
   it is applied to every string of every record first, including inside the
   identity parameters Routr adds to Record-Route. Then every digest response is
   recomputed with the test password of its username, as that username reads
   after the rewrites (the digest is stateless, so the record authenticates again
   on replay). So `credentials.yaml` holds the corpus's test usernames, which
   stay as they are, not the recorded ones; the command refuses a file whose
   rewritten digest username has no credential here and names both usernames.
   Fix that with `--rewrite <recorded username>=<test username>`. Don't add the
   recorded username to `credentials.yaml`: a username listed there stays in the
   output.

   Afterwards the command searches every string of the output for each original
   value of 5 or more characters. If one is still there, for example in a
   `User-Agent`, it exits 1, writes nothing and names the field but not the value:

   ```text
   sanitize: call.jsonl: seq 3 request.message.extensions[1].value still holds an input value
   ```

   A call from a stock Asterisk or FreeSWITCH peer stops here: the SDP `s=` line
   holds the product name, and so do the kept `User-Agent` and `Server`. Read the
   named field and the SDP of that record in the input. When the shared word is
   only a product name, keep it with `--rewrite Asterisk=Asterisk` (or
   `--rewrite FreeSWITCH=FreeSWITCH`). A value rewritten to itself stays in the
   output and leaves the search, so never do this with a person's data.

   A pass through this command doesn't prove the file is clean: a field nobody
   thought of can still hold something personal. Read the output before opening a
   pull request.
3. Add the Trunk, Number, Agent, Peer or Credentials the recording touches to
   `resources/` when they are not there yet. Every secret in `resources/` is a
   test value.
4. Add the file to `manifest.yaml`. A call that needs a registration first
   (a DID to an Agent) lists the REGISTER file before it. Use
   `profiles: [sip-connect]` for a file that faces a provider.

```yaml
resources: resources
files:
  - file: seet_sc-1.3.1-dod-invite_seet_20261023.jsonl
    profiles: [sip-connect]
    findings: [sip/private-address, sip/record-route-self]
    note: SIPconnect 1.1 test 1.3.1, agent 1001 to the provider
```

`findings` lists the rule ids the recording is known to trip: a known-good
describes what the chain does with real traffic, and real traffic (a SIPp
scenario that sends BYE with the caller's From, a lab where every network is
private) trips rules. Any finding not listed fails the build as a regression;
a listed rule that stops firing fails it too, so a behaviour change updates the
manifest in the same pull request. `rctl trace lint <file> --sip-connect`
prints what to declare.

`replay: false` keeps a file lint-only, for a recording whose chain state cannot
be reproduced from the files alone.

`draft: true` marks a recording nobody has reviewed yet, such as the first real
traffic from a new interconnect under `interop/`. It is replayed and linted
like any other file, so it guards the chain from the day it lands, and `rctl
trace compat` prints `(draft, needs review)` next to it. A reviewer checks the
flow and the declared findings, then removes the flag.

## Reading a drift

`npm run compat` prints one line per file and one per drift:

```text
≠ drift  seet_sc-1.3.1-dod-invite_seet_20261023.jsonl  7 records
  ≠ seq 2  outgoing message differs: Max-Forwards
```

Open the file with `rctl trace replay` to see the recorded message, and
`rctl trace send <file> --seq 2 --to localhost:51901` to see the live diff
against a running chain. When the new behaviour is the intended one, record the
scenario again and replace the file: the corpus describes what the chain does,
and a deliberate change updates it in the same pull request.
