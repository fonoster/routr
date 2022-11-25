# Routr Connect Processor

### Version 0.1.1 (Draft)

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

The keywords "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in the [specification](./CONNECT.md) are to be interpreted as described in [BCP 14](https://tools.ietf.org/html/bcp14) [[RFC2119](https://tools.ietf.org/html/rfc2119)] [[RFC8174](https://tools.ietf.org/html/rfc8174)] when, and only when, they appear in all capitals, as shown here.

### Purpose

This document aims to present a detailed description of Routr Connect. It will explain the purpose and features of the system, the interfaces of the system, what the system will do, the constraints under which it must operate, and how the system will react to external stimuli. The document is intended for both stakeholders and the developers of the system.

### Scope of Project

The software system will be a Processor that implements the logic to support a subset of the SIP Connect Specification. Hence the name Routr Connect. The Processor takes as input a MESSAGE from Routr Core, determines the type of communication type, manipulates the MESSAGE based on its kind, and forwards it back to the Core.

### Glossary

|                  | Description                                                                             |
| ---------------- | --------------------------------------------------------------------------------------- |
| *Routr Core*     | The central components that are required to implement Routr regardless of the Processor |
| *Processor*      | Feature server that carries the logic for a particular use case                         |
| *Connect Object* | A JSON Object describing a call session, including authorized actions                   |
| *SIP Client*     | A SIP Client is any SIP-capable device or software that communicates thru *Routr*       |
| *SIP Server*     | Also known as a SIP Proxy, deals with all the management of SIP requests in a network and is responsible for taking requests from the SIP Clients to place and terminate calls and process other types of requests                                 |
| *gRPC*           | Is a modern open-source, high-performance Remote Procedure Call (RPC) framework         |
| *Stakeholder*    | Any person with interest in the project which is not a developer                          |
| *Nexthop*        | The next network element within the signaling path of a given request                   |
| *M.E.L.T*        | M.E.L.T stands for Metrics, Events, Logs, Tracing                                       |

### References

IEEE/ISO/IEC 29148-2018 - ISO/IEC/IEEE International Standard - Systems and software engineering -- Life cycle processes -- Requirements engineering.

## Requirements Specification

### Connect Processor

**Brief Description**

The `Connect Processor` is a Routr Processor that carries the necessary logic to implement the SIP Connect v1.2 implementation. For this implementation, we are going to have named routing types. For example, Ingress Routing (IR) for calls coming from the PSTN, Egress Routing (ER) for calls going out to the PSTN, and Intra-Domain Routing (IDR) for internal calling.

**Functional Requirements**

Processing a MESSAGE consist of this basic steps:

```text
=> Message Processor Matched (by Message Dispatcher)
  => isValid (message) or return Bad Request (400) 
  => isAuthenticated(message) or send Authentication Challenge
  => isAuthorized(message) or send is Unauthorized
  => doProcess(message) and return updated request/response
```

The Processor will use a `Username/Password` scheme to authenticate Agents and Peers. On the other hand, a `Username/Password`, `IP Access List`, or a combination of both for inbound calls (Ingress Routing) coming from a Trunk.

It's also a requirement for the Processor to authorize requests. A traditional AAA may do the authorization service, such as a Diameter or Radius server, or by a custom authorization service.

Available actions are:

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
- Assert identity over a number for calls to the PSTN
- Connect to a backend service

</td>
<td>

`requestURI`, `p-asserted-identity`, `remote-party-id`

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

`requestURI`, `p-asserted-identity`, `remote-party-id`

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

`requestURI`, `webhook`

</td>
</tr>
</table>


The following JSON is an example of a `Connect Object` that results from processing a message:

```json
{
  "headers": [
    { "name:": "X-Backend-Name", "value": "voice", "action": "add"},
    { "name:": "X-Backend-Ref", "value": "voice", "action": "add"},
    { "name:": "X-Webhook-Get", "value": "voice", "action": "add"},
    { "name:": "X-Webhook-Post", "value": "voice", "action": "add"},
    { "name:": "X-GRPC-Endpoint", "value": "voice", "action": "add"},
    { "name:": "P-Asserted-Identity", "action": "delete"},
    { "name:": "Remote-Party-ID", "action": "delete"},
  ]
}
```

> A JWT token in the customer header `X-Connect-Token` could bypass the authentication and the need to construct `Connect Object`.

For error response, the `Connect Object` will look like this:

```json
{
  "type": "error",
  "code": 401,
  "reason": "Unauthorized",
  "headers": [
    { "name:": "X-Additional-Header", "value": "With a custom message", "action": "add" }
  ]
}
```

> Header should not allow for "add" action since it will be sent back as a response.

**Non-functional Requirements**

The following requirements are essential to have for an implementation of a *Connect Processor*:

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
    "ref": "ag2c77f4",
    "name": "John Doe",
    "dependsOn": [
      "/domain/dm2c76ft"
      "/domain/dm5774ux",
      "/credentials/crd2c76ft"
    ]
  },
  "spec": {
    "username": "johndoe",
    "domains": ["dm2c76ft", "dm5774ux"],
    "credentialRef": "crd2c76ft",
    "enabled": true
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
    "ref": "dm2c76ft",
    "name": "Local Domain",
    "dependsOn": ["/number/nb6c87r2"]
  },
  "spec": {
    "context": {
      "domainUri": "sip.local",
      "egressPolicy": {
        "rule": ".*",
        "numberRef": "nb6c87r2"
      },
      "accessControlListRef": "acl04b5y"
    }
  }
}
```

Use a Trunk resource to communicate with SIP Gateways, SIP Providers, and SBCs and send or receive calls from the PSTN.

Example:

```json
{
  "apiVersion": "v2draft1",
  "kind": "Trunk",
  "metadata": {
    "ref": "tk6t67r1",
    "name": "VoIP.ms Trunk",
    "region": "us-east1",
    "dependsOn": [
      "/acl/acl04b5y",
      "/credential/crd02s23"
    ]
  },
  "spec": {
    "inbound": {
      "uri": "fn01.sip.fonoster.com",
      "accessControlListRef": "acl04b5y",
      "credentialsRef": "crd02s23"
    },
    "outbound": {
      "sendRegister": false,
      "credentialsRef": "crd02s23",
      "uris": [
        {
          "uri": {
            "user": "username",
            "host": "sip.provider.net",
            "port": 5060,
            "transport": "udp"
          },
          "priority": 10,
          "weight": 10,
          "enabled": true
        }
      ]
    }
  }
}
```

Numbers represent virtual numbers that route calls from/to the PSTN via a Trunk.

```json
{
  "apiVersion": "v2draft1",
  "kind": "Number",
  "metadata": {
    "ref": "nbxt67rx",
    "name": "(706)604-1487",
    "dependsOn": [
      "/trunk/tk6t67r1"
    ],
    "geoInfo": {
      "city": "Columbus, GA",
      "country": "USA",
      "countryISOCode": "US"
    }
  },
  "spec": {
    "trunkRef": "tk6t67r1",
    "location": {
      "telUrl": "tel:17066041487",
      "aorLink": "backend:conference",
      "sessionAffinityProp": "x-room-id",
      "props": [{
        "name": "x-room-id",
        "value": "jsa-shqm-iyo"
      }]
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
    "ref": "prxt67rx",
    "name": "Asterisk (Media Server)",
    "dependsOn": ["/credentials/crd6t67r1"],
  },
  "spec": {
    "credentialsRef": "crd6t67r1",
    "aor": "backend:conference",
    "contactAddr": "192.168.1.2:6060"
  }
}
```

**Communication with Adjacent Services**

Adjacent to the *Connect Processor* is the *Message Dispatcher*. The communication flows from the *Message Dispatcher* to the *Connect Processor*, where the *Connect Processor* is the server and *Message Dispatcher* is the client. 

The *Connect Processor* MUST communicate using the following protobuf interface:

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
