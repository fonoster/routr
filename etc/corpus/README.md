# SEET fixtures and shared replay resources

The SEET compliance recordings, calls that behaved as they should, replayed
through the chain on every pull request, and `resources/`, the Trunks, Numbers,
Agents and Credentials every replay uses. Partner recordings go to
`interop/<partner>/` with that folder's `manifest.yaml` (see
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
     --rewrite +13055550100=+15555550100 \
     --rewrite sip.realprovider.net=sip.provider.net \
     --out interop/twilio/zoiper_dod-invite_twilio_20261101.jsonl
   ```

   Each rewrite is applied to every string of every record first, including
   inside the identity parameters Routr adds to Record-Route. Then every digest
   response is recomputed with the test password of its username, as that
   username reads after the rewrites (the digest is stateless, so the record
   authenticates again on replay). So `credentials.yaml` holds the corpus's test
   usernames, not the recorded ones; the command refuses a file whose rewritten
   digest username has no credential here and names both usernames.
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
