# Routr Connect Processor

### Version 0.1.0 (Draft)

<details>
<summary>Table of Contents</summary>

<!-- toc -->

- [Introduction](#introduction)
  * [Document Convention](#document-conventions)
  * [Purpose](#purpose)
  * [Scope of Project](#scope-of-project)
  * [Glossary](#glossary)
  * [References](#references)
- [Requirements Specification](#requirements-specification)
  * [Connect Processor](#connect-processor)

<!-- tocstop -->

</details>

## Introduction

### Document Conventions 

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in the [specification](./CONNECT.md) are to be interpreted as described in [BCP 14](https://tools.ietf.org/html/bcp14) [[RFC2119](https://tools.ietf.org/html/rfc2119)] [[RFC8174](https://tools.ietf.org/html/rfc8174)] when, and only when, they appear in all capitals, as shown here.

### Purpose

This document aims to present a detailed description of Routr Connect. It will explain the purpose and features of the system, the interfaces of the system, what the system will do, the contraints under which it must operate, and how the system will react to external stimuli. The document is intended for both stakeholders and the developers of the system.

### Scope of Project

The software system will be a Processor that implements the logic to support a subset of the SIP Connect Specification. Hence the name Routr Connect. The processor takes as input a MESSAGE from Routr Core, determines the type communication type, manipulates the MESSAGE based on its type, and forwards back to the Core.

### Glossary

|  | Description |
| ----------- | ----------- |
| *Routr Core* | The central components that are require to implement Routr regardles of the Processor |
| *Processor* | Feature server the carries the logic for a particular use-case |
| *Connect Object* | A JSON Object describing a call session, including authorized actions |
| *SIP Client* | A SIP Client is any SIP capable device or software that communicates thru *Routr* |
| *SIP Server* | Also known as a SIP Proxy, deals with all the management of SIP requests in a network and is responsible for taking requests from the SIP Clients to place and terminate calls and process other types of requests |
| *gRPC* | Is a modern open-source, high-performance Remote Procedure Call (RPC) framework |
| *Stakeholder* |Any person with interest in the project who is not a developer |
| *Nexthop* | The next network element within the signaling path of a given request |
| *M.E.L.T* | M.E.L.T stands for Metrics, Events, Logs, Tracing |

### References

IEEE/ISO/IEC 29148-2018 - ISO/IEC/IEEE International Standard - Systems and software engineering -- Life cycle processes -- Requirements engineering

## Requirements Specification

### Connect Processor

**Brief Description**

The `Connect Processor` is a Routr Processor carries the neccesary logic to implement the SIP Connect v1.2 implementation. For the purpose of this implementation we are going to have named routing types. For example Ingress Routing(IR) for calls comming from the PSTN, Egress Routing (ER) for calls going out to the PSTN, and Intra-Domain Routing (IDR) for internal calling. 

**Functional Requirements**

Processing a MESSAGE consist in this basic steps:

```text
=> Message Processor Matched (by Message Dispatcher)
  => isValid (message) or return Bad Request (400) 
  => isAuthenticated(message) or send Authentication Challenge
  => isAuthorized(message) or send is Unauthorized
  => doProcess(message) and return updated request/response
```

The Processor will use a `Username/Pass` scheme to authenticate Agents and Peers. In the other hand, a `Username/Pass` and/or `IP Access List` for inbound calls (Ingress Routing) comming from a Trunk.

Its also a requiement for the Processor to authorized requests. The autorization may be done by a traditional AAA service such as a Diameter or Radius server or by a custom authorization service.

Authorized actions include:

<table>
<tr>
<td> Endpoint Type </td> <td> Action </td> <td> Modifiers </td>
</tr>
<tr>
<td> 

`Agent` 

</td>
<td>

- Call any AOR w/ the same Domain
- Assert identity over a Number for calls to the PSTN
- Connect to a backend service

</td>
<td>

`requestURI`, `maxSessionDuration`, `p-asserted-identity`, `remote-party-id`

</td>
</tr>

<tr>
<td> 

`Peer` 

</td>
<td>
Assert identity over a Number for calls to the PSTN
</td>
<td>

`requestURI`, `maxSessionDuration`, `p-asserted-identity`, `remote-party-id`

</td>
</tr>

<tr>
<td> 

`Trunk` 

</td>
<td>
Forward inbound traffic if its a Number it controls
</td>
<td>

`requestURI`, `maxSessionDuration`, `webhook`

</td>
</tr>
</table>


The following JSON is an example of a `Connect Object` that results from processing a message:

```json
{
  "type": "ingress-routing",
  "maxSessionDuration": -1,
  "authentication": null,
  "headers": [
    { "Request-URI": "sip:+19524563516@47.132.130.31:5060" },
    // Need only for ER
    { "X-Backend-Name": "voice"},
    { "X-Backend-Ref": "id:a4Fgsfg3"},
    { "X-Webhook-Get": "https://868a-47-132-130-31.ngrok.io"},
    { "X-Webhook-Post": "https://868a-47-132-130-31.ngrok.io"},  
    { "X-GRPC-Endpoint": "api.remoteservice.io:50051"},
    { "P-Asserted-Identity": "tel:+19524563516"},
    { "Remote-Party-ID": "eric <sip:2001@123.123.123.123>;privacy=off;screen=no"}
  ]
}
```

Other `Connect Object` types include "ingress-routing", "egress-routing", and "intra-domain-routing".

> A signed request we the custom header `X-Fonoster-Rtr` could bypass the authentication and the need to construct a `Connect Object`.

**Non-functional Requirements**

The following requirements are essential to have for an implementation of a *Connnect Processor*:

- *Msg Processed/second* - Should be able to process *TBT* number of Msg per second
- *Recoverability* - Recover from an unhealthy state

**Service Configuration**

Agents represent SIP endpoints such as softphones, IP phones, or paging speakers. 

Example:

```json
{
  "apiVersion": "v2draft1",
  "kind": "Agent",
  "metadata": {
    "name": "John Doe"
  },
  "spec": {
    "domains": ["sip.local"],
    "credentialRef": "..."
  }
}
```

Domains group Agents together. They help isolate groups and allow the creation of rules for calls to/from the PSTN.

Example:

```json
{
  "apiVersion": "v2draft1",
  "kind": "Domain",
  "metadata": {
    "name": "Local Domain"
  },
  "spec": {
    "context": {
      "domainUri": "sip.local",
      "egressPolicy": {
        "rule": ".*",
        "numberRef": "NR0001"
      },
      "accessControlList": {
        "deny": [
          "0.0.0.0/1"
        ],
        "allow": [
          "192.168.0.1/31"
        ]
      }
    }
  }
}
```

Use a Trunk resource to communicate with a SIP Gateways, SIP Providers, SBCs and send or receive calls from the PSTN.

Example:

```json
{
  "apiVersion": "v2draft1",
  "kind": "Trunk",
  "metadata": {
    "name": "VoIP.ms Trunk",
    "ref": "TK0001"
  },
  "spec": {
    "inbound": {
      "uri": "fn01.sip.fonoster.com",
      "accessControlListRef": "acl04b5y",
      "credentialsRef": "cred02s23"
    },
    "outbound": {
      "sendRegister": false,
      "credentialsRef": "cred02s23",
      "uris": [
        { "uri": "sip:sip.acme.com;transport=tcp", "priority": 10, "weight": 10, "enabled": true }
      ]
    }
  }
}
```

Numbers represent virtual numbers used to route calls from/to the PSTN via a Trunk.

```json
{
  "apiVersion": "v2draft1",
  "kind": "Number",
  "metadata": {
    "ref": "NR0001",
    "tkRef": "TK0001",
    "geoInfo": {
      "city": "Columbus, GA",
      "country": "USA",
      "countryISOCode": "US"
    }
  },
  "spec": {
    "location": {
      "telUrl": "tel:17066041487",
      "aorLink": "backend:conference",
      "sessionAffinityProp": "x-room-id",
      "props": [
        { "x-room-id": "jsa-shqm-iyo" }
      ]
    }
  }
}
```

Like Agents, Peers represent SIP endpoints such as Media Servers. Unlike Agents, Peers aren't bound by a Domain.

```json
{
  "apiVersion": "v2draft1",
  "kind": "Peer",
  "metadata": {
    "name": "Asterisk (Media Server)"
  },
  "spec": {
    "credentialsRef": "my-ip-credentials",
    "aor": "backend:conference",
    "contactAddr": "192.168.1.2:6060"
  }
}
```

**Communication with Adjacent Services**

Adjacent to the *Connect Processor* is the *Message Dispatcher*. The communication flows from the *Message Dispatcher* to the *Connect Processor*, where the *Connect Processor* is the server and *Message Dispatcher* is the client. The *Connect Processor* MUST communicate using the following protobuf interface:

```proto
syntax = "proto3";

package fonoster.routr.processor.v2draft1;

// Processor service
service Processor {
  // Process Message Request
  rpc ProcessMessage (MessageRequest) returns (MessageResponse) {}
}
```

**Test Criteria**

Message Processor SHOULD have Unit Testing for all its core functionalities.

**Security Considerations**

None.

**Special Considerations**

None.