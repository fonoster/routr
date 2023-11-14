# Test Plan

## DUT and Endpoints Configuration

- Routr has a Gateway resource configured to use TCP transport.
- The Gateway resource is configured with a range of E.164 numbers.
- Routr is configured to support Registration mode.
- A Domain named `sip.local` exist with Agents `1001@sip.local` and `1002@sip.local`
- The Gateway is capable of handling RFC6140 registrations

## Test Case Summary

| Test Case ID | Title                                                | Required  |
| ------------ |:---------------------------------------------------- | ---------:|
|  1.1.1       |  Registration Setup                                  | Yes       |
|  1.1.2       |  Registration Failure                                | Yes       |
|  1.1.3       |  Maintaining Registration                            | Yes       |
|  1.1.4       |  Authentication                                      | Yes       |
|  1.1.5       |  TLS Server Mode                                     | No        |
|  1.2.1       |  DNS Lookup                                          | Yes       |
|  1.2.2       |  Static Mode Failure Detection                       | No        |
|  1.2.3       |  TLS Authentication                                  | No        |
|  1.2.4       |  TLS Certificate Validation                          | No        |
|  1.3.1       |  Intra-Domain Routing   / Successful Invite Setup    | Yes       |
|  1.3.2       |  Intra-Domain Routing   / Invite Rejected by Callee  | Yes       |
|  1.3.3       |  Intra-Domain Routing   / Invite Cancelled by Caller | Yes       |
|  1.3.4       |  Intra-Domain Routing   / Invite Cancelled by Callee | Yes       |
|  1.4.1       |  Domain-Ingress Routing / Successful Invite Setup    | Yes       |
|  1.4.2       |  Domain-Ingress Routing / Invite Rejected by Callee  | Yes       |
|  1.4.3       |  Domain-Ingress Routing / Invite Cancelled by Caller | Yes       |
|  1.4.4       |  Domain-Ingress Routing / Invite Cancelled by Callee | Yes       |
|  1.5.1       |  Domain-Egress Routing  / Successful Invite Setup    | Yes       |
|  1.5.2       |  Domain-Egress Routing  / Invite Rejected by Callee  | Yes       |
|  1.5.3       |  Domain-Egress Routing  / Invite Cancelled by Caller | Yes       |
|  1.5.4       |  Domain-Egress Routing  / Invite Cancelled by Callee | Yes       |
|  1.6.1       |  Peer-Egress Routing    / Successful Invite Setup    | Yes       |

## Test Cases

### Test Case 1.1.1: Registration Setup

*Objective*: This section tests the registration compatibility between Routr and the SIP Trunk provider. If the SIP Trunk provider under testing is IP-based, this section can be skipped.

*Procedure*:

|         | Description                                                 | Expected Result  |
| ------- |:------------------------------------------------------------|:-----------------|
| Step 1  | Restart Routr to send a REGISTER message to the Gateway     | Routr restarts   |
| Step 2  | Wait for the server to restart                              | UAS receives correct registration sequence |
| Step 3  | Clear the registration table                                | Registry table is empty |


