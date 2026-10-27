# Interop certification

Certification gives your customers a public record of which call flows were
tested with Routr, when, and the recorded evidence for each. After
certification, every change to Routr is replayed against your recordings
before it merges.

## How it works

1. Email team@fonoster.com to ask for certification.
2. We agree on a meeting. During it both sides create the trunking: a Routr
   Trunk and Number toward you, and your trunk toward Routr.
3. We run the checklist together and mark each case pass or fail in
   `interop/<partner>/RESULTS.md`.
4. Every passing call is recorded with Routr's call recording and sanitized so
   it can be committed.
5. When every case passes, the final recordings are dated, committed to
   `interop/<partner>/` and replayed on every pull request, so a change that
   breaks your interconnect fails the build.

## What we test

"Outbound (DOD)" is a call from Routr to you, "Inbound (DID)" a call from you
to Routr. Each call case runs in both directions; re-INVITE and transfer run
with each side sending the in-dialog request.

- **Setup and teardown**
  - INVITE answered, caller BYE
  - INVITE answered, callee BYE
- **CANCEL and rejections**
  - CANCEL before answer
  - Callee busy (486) or declines (603)
- **Mid-call re-INVITE**
  - re-INVITE with SDP (hold/resume)
  - re-INVITE without SDP
- **Transfer**
  - Blind transfer by the partner (re-INVITE plus new INVITE to the target)
  - Blind transfer with REFER (in-dialog only)
  - Attended transfer (REFER with Replaces), when you support it

## What we keep

Recordings are
[sanitized](https://docs.routr.io/guides/record-and-replay-calls#keep-a-known-good-corpus)
before they are committed: numbers, hostnames, public addresses and
credentials become test values. How the files are named and replayed is in
[etc/corpus/README.md](../etc/corpus/README.md).

## Afterwards

A change to Routr that breaks the signaling of a certified flow fails Routr's
build. When something changes on your side, ask us to re-run the checklist and
re-record. The date in each file name is when that flow was last verified.

The replay checks the SIP messages Routr's routing chain (dispatcher, Connect,
location) produces; it does not check the transport (EdgePort, TLS), NAT or
media, which the certification session itself covers.

## Partners

- [WhatsApp Business Calling](whatsapp/RESULTS.md): in progress

## Contact

team@fonoster.com
