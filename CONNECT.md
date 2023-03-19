# Routr Connect Processor

### Version 0.1.5 (Draft)

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
| *SIP Server*     | Also known as a SIP Proxy, deals with all the management of SIP requests in a network and is responsible for taking requests from the SIP Clients to place and terminate calls and process other types of requests |
| *gRPC*           | Is a modern open-source, high-performance Remote Procedure Call (RPC) framework         |
| *Stakeholder*    | Any person with interest in the project which is not a developer                        |
| *Nexthop*        | The next network element within the signaling path of a given request                   |
| *M.E.L.T*        | M.E.L.T stands for Metrics, Events, Logs, Tracing                                       |

### References

IEEE/ISO/IEC 29148-2018 - ISO/IEC/IEEE International Standard - Systems and software engineering -- Life cycle processes -- Requirements engineering.

## Requirements Specification

### Connect Processor

**Brief Description**

The `Connect Processor` is a Routr Processor that carries the necessary logic to implement the **SIP Connect v1.1** specification. For this implementation, we are going to have named routing types. For example, Ingress Routing (IR) for calls coming from the PSTN, Egress Routing (ER) for calls going out to the PSTN, and Intra-Domain Routing (IDR) for internal calling.

**Functional Requirements**

Processing a MESSAGE consist of this basic steps:

```text
=> Message Processor Matched (by Message Dispatcher)
  => isValid (message) or return Bad Request (400) 
  => isAuthenticated(message) or send Authentication Challenge
  => isAuthorized(message) or send is Unauthorized
  => doProcess(message) and return updated request/response
```

To authenticate Agents and Peers, the Processor will implement a `Username/Password` authentication scheme. In contrast, for inbound calls (Ingress Routing) from a Trunk, the Processor will use a combination of `Username/Password` and `IP Access List` or either of the two methods individually. The actions available will correspond to the specific endpoint types as outlined below:

<table>
<tr>
<td> Endpoint Type </td> <td> Available Actions </td>
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
</tr>

<tr>
<td> 

`Peer`

</td>
<td>
Assert identity over a Number for calls to the PSTN
</td>
</tr>

<tr>
<td> 

`Trunk`

</td>
<td>
Forward inbound traffic if its a Number it controls
</td>
</tr>
</table>

Furthermore, an Agent can utilize the custom header X-Connect-Token to transmit a JWT that contains claims enabling the Agent to execute routing operations like a typical Agent. The JWT payload will consist of values that resemble an Agent configuration, and it will have the following claims:

```json
{
  "ref": "agent-01",
  "aor": "sip:1001@sip.local",
  "aorLink": "backend:voice",
  "domain": "sip.local",
  "domainRef": "domain-01",
  "allowedMethods": [ "INVITE", "REGISTER"],
  "privacy": "NONE"
}
```

**Non-functional Requirements**

The following requirements are essential to have for an implementation of a *Connect Processor*:

- *Msg Processed/second* - Should be able to process *TBT* number of Msg per second
- *Recoverability* - Recover from an unhealthy state

**Service Configuration**

Agents represent SIP endpoints such as softphones, IP phones, or paging speakers.

Example:

```json
{
  "apiVersion": "v2beta1",
  "kind": "Agent",
  "ref": "agent-01",
  "metadata": {
    "name": "John Doe"
  },
  "spec": {
    "username": "johndoe",
    "domainRef": "domain-01",
    "credentialsRef": "credentials-01",
    "privacy": "Private",
    "enabled": true
  }
}
```

Domains group Agents together. They help isolate groups and allow the creation of rules for calls to/from the PSTN.

Example:

```json
{
  "apiVersion": "v2beta1",
  "kind": "Domain",
  "ref": "domain-01",
  "metadata": {
    "name": "Local Domain"
  },
  "spec": {
    "context": {
      "domainUri": "sip.local",
      "accessControlListRef": "acl-01",
      "egressPolicies": [{
        "rule": ".*",
        "numberRef": "number-01"
      }]
    }
  }
}
```

Use a Trunk resource to communicate with SIP Gateways, SIP Providers, and SBCs and send or receive calls from the PSTN.

Example:

```json
{
  "apiVersion": "v2beta1",
  "kind": "Trunk",
  "ref": "trunk-01",
  "metadata": {
    "name": "VoIP.ms Trunk",
    "region": "us-east1"
  },
  "spec": {
    "inbound": {
      "uri": "fn01.sip.fonoster.com",
      "accessControlListRef": "acl-01",
      "credentialsRef": "credentials-04"
    },
    "outbound": {
      "sendRegister": false,
      "credentialsRef": "credentials-04",
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
  "apiVersion": "v2beta1",
  "kind": "Number",
  "ref": "number-01",
  "metadata": {
    "localFormat": "(706)604-1487",
    "geoInfo": {
      "city": "Columbus, GA",
      "country": "USA",
      "countryISOCode": "US"
    }
  },
  "spec": {
    "trunkRef": "trunk-01",
    "location": {
      "telUrl": "tel:+17066041487",
      "aorLink": "backend:conference",
      "sessionAffinityHeader": "X-Room-Id",
      "extraHeaders": [{
        "name": "X-Room-Id",
        "value": "jsa-shqm-iyo"
      }]
    }
  }
}
```

Like Agents, Peers represent SIP endpoints such as Media Servers. Unlike Agents, Peers aren't bound by a Domain.

```json
{
  "apiVersion": "v2beta1",
  "kind": "Peer",
  "ref": "peer-01",
  "metadata": {
    "name": "Asterisk (Media Server)"
  },
  "spec": {
    "username": "asterisk",
    "aor": "backend:conference",
    "contactAddr": "192.168.1.2:6060",
    "credentialsRef": "credentials-01",
    "loadBalancing": {
      "withSessionAffinity": true,
      "algorithm": "least-sessions"
    }
  }
}
```

**Communication with Adjacent Services**

Adjacent to the *Connect Processor* is the *Message Dispatcher*. The communication flows from the *Message Dispatcher* to the *Connect Processor*, where the *Connect Processor* is the server and *Message Dispatcher* is the client. 

The *Connect Processor* MUST communicate using the following protobuf interface:

```proto
syntax = "proto3";

package fonoster.routr.processor.v2beta1;

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
