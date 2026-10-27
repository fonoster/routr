# WhatsApp Business Calling interop results

Status: in progress, not certified. Results come from draft recordings still pending review.
Partner element: WhatsApp Business Calling over SIP (wa.meta.vc, TLS)
Routr version: v2.28.0

| Case | Direction | Result | Date | Recording | Reference |
| --- | --- | --- | --- | --- | --- |
| INVITE answered, caller BYE | Outbound (DOD) | Pass | 2026-10-25 | [sipjs_wa-dod-invite_whatsapp_20261025.jsonl](sipjs_wa-dod-invite_whatsapp_20261025.jsonl) | SC 1.3.1 |
| INVITE answered, caller BYE | Inbound (DID) | Not run | - | - | SC 1.3.2 |
| INVITE answered, callee BYE | Outbound (DOD) | Not run | - | - | RR 1.5.1 |
| INVITE answered, callee BYE | Inbound (DID) | Not run | - | - | RR 1.5.1 |
| CANCEL before answer | Outbound (DOD) | Partial: CANCEL sent; 200, 487 and ACK not in the recording | 2026-10-25 | [sipjs_wa-dod-invite-cancel_whatsapp_20261025.jsonl](sipjs_wa-dod-invite-cancel_whatsapp_20261025.jsonl) | RR 1.1.3 |
| CANCEL before answer | Inbound (DID) | Not run | - | - | RR 1.1.3 |
| Callee busy (486) or declines (603) | Outbound (DOD) | Not run | - | - | RR 1.2.1, RR 1.1.4 |
| Callee busy (486) or declines (603) | Inbound (DID) | Not run | - | - | RR 1.2.1, RR 1.1.4 |
| re-INVITE with SDP (hold/resume) | Partner sends | Not run | - | - | SC 12.2.1, SC 12.2.3 |
| re-INVITE with SDP (hold/resume) | Routr side sends | Not run | - | - | SC 12.2.1, SC 12.2.3 |
| re-INVITE without SDP | Partner sends | Not run | - | - | SC 12.2.2, SC 12.2.4 |
| re-INVITE without SDP | Routr side sends | Not run | - | - | SC 12.2.2, SC 12.2.4 |
| Blind transfer by the partner (re-INVITE plus new INVITE to the target) | Partner | Not run | - | - | SC 12.1.1 |
| Blind transfer with REFER (in-dialog only) | Partner sends | Not run | - | - | RR 1.8.1, RR 1.8.2 |
| Blind transfer with REFER (in-dialog only) | Routr side sends | Not run | - | - | RR 1.8.1, RR 1.8.2 |
| Attended transfer (REFER with Replaces), when the partner supports it | Partner sends | Not run | - | - | none in Routr's suite |
| Attended transfer (REFER with Replaces), when the partner supports it | Routr side sends | Not run | - | - | none in Routr's suite |

Reference ids are Routr's own SEET tests in `etc/seet.json`: "SC x" is `SC-IT.Conf.x` (SIPconnect 1.1), "RR x" is `RR.Tst.Plan.x`.

Setup: [sipjs_register-before-wa-dod-invite_routr_20261025.jsonl](sipjs_register-before-wa-dod-invite_routr_20261025.jsonl) is the registration of the SIP.js dialer that the outbound calls need; it is not a case.
