# Routr Specification

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
  * [EdgePort](#edgeport)
  * [Message Router](#message-router)
  * [Message Processor](#message-processor)
  * [Data APIs](#data-apis)

<!-- tocstop -->

</details>

## Introduction

### Document Conventions 

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in the [specification](./specification/overview.md) are to be interpreted as described in [BCP 14](https://tools.ietf.org/html/bcp14) [[RFC2119](https://tools.ietf.org/html/rfc2119)] [[RFC8174](https://tools.ietf.org/html/rfc8174)] when, and only when, they appear in all capitals, as shown here.

### Purpose

The purpose of this document is to present a detailed description of the SIP Server *Routr*. It will explain the purpose and features of the system, the interfaces of the system, what the system will do, the constraints under which it must operate and how the system will react to external stimuli. This document is intended for both the stakeholders and the developers of the system.

### Scope of Project

This software system will be a SIP Server acts as the signaling as part of Fonoster Ecosystem. This system will be designed to maximize scalability and extensibility by making use of a microservice architecture which a challegning factor on **v1**. By using a microservice architecture we will ensure that portions of the system be able to be deployed independly, and each treated according with its problem domain.

More specifically, this system will be designed to allow for separation of concerns for the SIP Server. The software MUST be able to accept SIP Messages via *UDP*, *TCP*, *TLS*, *WS*, and *WSS*. It should then, parse the messages effiently and facilitate the communication between the various components.

Furthermore, the system MUST include a mechanism to replace the SIP Message processing without updating the entire system. It should also facilitate communication with external system for Authentication, Authorization, and Accounting (AAA) and allow to host multiple-tenants thru the use of a Role-based Access Control (RBAC) system.

### Glossary

- *Backend Service* - A service that provides a use-case or capability for the overall system (i.e Asterisk or FreeSWITCH)
- *SIP Client* - A SIP Client is any SIP capable device or software that communicates thru *Routr*
- *Role Based Access Control (RBAC)* - Mechanism that restricts access to parts of Routr based on a user's role and resource ownership
- *SIP Server* - also known as a SIP Proxy, deals with all the management of SIP requests in a network and is responsible for taking requests from the SIP Clients in order to place and terminate calls and process other type of requests
- *gRPC* - Is a modern open source high performance Remote Procedure Call (RPC) framework
- *Stakeholder* - Any person with an interest in the project who is not a developer.
- *Nexthop* - The next network element within the signaling path for given request
 
### References

IEEE/ISO/IEC 29148-2018 - ISO/IEC/IEEE International Standard - Systems and software engineering -- Life cycle processes -- Requirements engineering

## Requirements Specification

<!--
Diagram generated with: https://arthursonzogni.com/Diagon/#GraphDAG
Raw Diagram:
 EdgePort 001 -> Message Router
 EdgePort 002 -> Message Router
 Message Router -> SCAIP Processor
 Message Router -> Fallback Processor
 Message Router -> Twilio Processor
 SCAIP Processor -> Data APIs & External Services
-->

```none
┌────────────┐┌────────────┐                           
│EdgePort 001││EdgePort 002│                           
└┬───────────┘└┬───────────┘                           
┌▽─────────────▽───────────────────────┐               
│Message Router                        │               
└┬────────────────┬───────────────────┬┘               
┌▽──────────────┐┌▽─────────────────┐┌▽───────────────┐
│SCAIP Processor││Fallback Processor││Twilio Processor│
└┬──────────────┘└──────────────────┘└────────────────┘
┌▽────────────────────────────┐                        
│Data APIs & External Services│                        
└─────────────────────────────┘                        
```

The SIP Server "Routr" has thre main components and one cooperating service. The first component, the EdgePort, is responsible for accepting SIP Messages parsing them into protobuf and sending them to the Message Router. After a SIP Message is process the EdgePort will forward it to nexthop.

The job of Message Router is to accept SIP Messages encapsulated as protobuf from the EdgePort, and routing the SIP Message to and from the Message Processor.

Message Processors are reponsible for the authentication, validation, and processing of SIP Message, and updating the SIP Messages so that they can reach their destination.

### EdgePort

<!--
Diagram generated with: https://arthursonzogni.com/Diagon/#Sequence
Raw Diagram:
  SIP Client -> EdgePort: SIP Request
  EdgePort -> Message Router: gRPC Request
  EdgePort <- Message Router: gRPC Response
  SIP Client <- EdgePort: SIP Response
-->

```
 ┌──────────┐  ┌────────┐ ┌──────────────┐
 │SIP Client│  │EdgePort│ │Message Router│
 └────┬─────┘  └───┬────┘ └──────┬───────┘
      │            │             │        
      │SIP Request │             │        
      │───────────>│             │        
      │            │             │        
      │            │gRPC Request │        
      │            │────────────>│        
      │            │             │        
      │            │gRPC Response│        
      │            │<────────────│        
      │            │             │        
      │SIP Response│             │        
      │<───────────│             │        
 ┌────┴─────┐  ┌───┴────┐ ┌──────┴───────┐
 │SIP Client│  │EdgePort│ │Message Router│
 └──────────┘  └────────┘ └──────────────┘
```

**Brief Description**

The EdgePort component is a service that sits at the edge of the network. The job of the EdgePort is to receive SIP Messages parse them into protobuf and forward downstream for procesing. A *Routr* network might have multiple EdgePorts.

**Functional Requirements**

The following functionality are Must have for an implementation of an *EdgePort*:

- *Accept SIP Msg* - Accept Messages using as transport *UDP*, *TCP*, *TLS*, *WS*, and *WSS*
- *Accept SIP Msg (Part2)* - Accept Messages on all interfaces
- *Parse SIP Msg* - Parse Messages into a protobuf
- *Keep Msg's state* - MUST keep the state until the Message is processed or a timeout occurrs
- *Reject Msgs from banned IPs* - MUST have a mechanism to indentify and discard unwanted Messages
- *Health Check* - MUST have a mechanism to indentify health of the service 

**Non-functional Requirements**

The following requirements are Nice to have for an implementation of an *EdgePort*:

- *Parsing Time* -  Msg parse time effeciency should < *TBT*
- *Msg Processed/second* - Should be able to process *TBT* number of Msg per second
- *Recoverability* - Recover from an unhealthy state

**Service Configuration**

The configuration for the *EdgePort* could be represented as a *json* or *yaml* formats, however validation will done as per [https://json-schema.org](https://json-schema.org/learn/getting-started-step-by-step). The following example, sumarizes de configuration REQUIRED by the *EdgePort*:

```json
{
  "kind": "EdgePort",
  "apiVersionv": "v2beta1",
  "metadata": {
    "ref": "ep001",
    "region": "us-east1"
  },
  "spec": {
    "bindAddr": "0.0.0.0",
    "advertisedAddrs": [
      "165.227.217.102",
      "sip01.fonoster.io"
    ],
    "localnets": [
      "192.168.1.9"
    ],
    "allowedRequets": [
      "INVITE",
      "MESSAGE",
      "REGISTER"
    ],
    "transport": [
      {
        "protocol": "tcp",
        "bindAddr": "192.168.1.148",
        "port": 5060
      },
      {
        "port": 5060,
        "protocol": "udp"
      }
    ]
  }
}
```

<details>
<summary>Schema:</summary>

 ```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/fonoster/routr/schemas/edgeport.schema.json",
  "title": "EdgPort configuration",
  "description": "Configuration for an EdgePort instance",
  "type": "object",
  "properties": {
    "kind": {
      "description": "Resouce type",
      "type": "string"
    },
    "apiVersion": {
      "description": "Resource version",
      "type": "string"
    },
    "metadata": {
      "description": "Resource metadata",
      "type": "object"
      "properties": {
         "ref": {
           "description": "EdgePort reference",
           "type": "string"
         },
         "region": {
           "description": "Optional region where the EdgePort is operating",
           "type": "string"
         }
       },
      "required": [ "ref" ]
    },
    "spec": {
      "description": "Operation spec for the EdgePort",
      "type": "object"
      "properties": {
         "bindAddr": {
           "description": "Ipv4 interface to accept request on",
           "type": "string"
         },
         "advertisedAddrs": {
           "description": "EdgePort external addresses. Might be Ipv4, Hostname",
           "type": "array",
           "items": {
             "type": "string"
           },
           "uniqueItems": true
           "minItems": 1,
         },
         "localnets": {
           "description": "Networks considered to be in the same local network",
           "type": "array",
           "items": {
             "type": "string"
           },
           "uniqueItems": true
           "minItems": 1,
         },
         "acceptableSIPMessages": {
           "description": "Acceptable SIP Messages",
           "type": "array",
           "items": {
             "type": "string"
           },
           "uniqueItems": true
         },
         "transport": {
           "description": "Acceptable Transport",
           "type": "array",
           "items": {
             "type": "object"
           }
           "properties": {
             "protocol": {
               "type": "string"
             },
             "bindAddr": {
               "type": "string"
             },
             "port": {
               "type": "integer"
             }
           }
         }
       },
      "required": [ "ref" ]
    }    
  },
  "required": [ "kind" ]
}
```
</details>

**Communication with Adjacent Services**

Adjecent to the EdgePort is the Message Router. The communication between this two services is done using gRPC and protobuf.

<details>
<summary>Message Proto</summary>

```none
 // TODO
```

</details>

**Test Criteria**

> TODO: Cover tools and require integration tests

**Security Considerations**

> TODO: Explore security considerations

**Special Considerations**

Running the EdgePort in Kubernetes can be challenging. Keep following in mind when deploying to Kubernetes:

1. Kubernetes' loadbalancers aren't design to work with SIP 
2. The EdgePort uses the SIP procol which requires of L7 loadbalancers
3. A complex network topology could disrupt the service and create latency

> TODO: Show potential solutions

### Message Router

```none
 ┌────────┐ ┌──────────────┐                 ┌─────────────────┐
 │EdgePort│ │Message Router│                 │Message Processor│
 └───┬────┘ └──────┬───────┘                 └────────┬────────┘
     │             │                                  │         
     │gRPC Request │                                  │         
     │────────────>│                                  │         
     │             │                                  │         
     │             │findProcessor() & forwardMessage()│         
     │             │─────────────────────────────────>│         
     │             │                                  │         
     │             │        Processed Message         │         
     │             │<─────────────────────────────────│         
     │             │                                  │         
     │gRPC Response│                                  │         
     │<────────────│                                  │         
 ┌───┴────┐ ┌──────┴───────┐                 ┌────────┴────────┐
 │EdgePort│ │Message Router│                 │Message Processor│
 └────────┘ └──────────────┘                 └─────────────────┘
```

**Brief Description**

The Message Router component takes a SIP message and forwards them to the corresponding Message Processor. The matching process is done using the request coming from the EdgePort. 

The Message Router will always use the first processor that matches a request, and use a **fallback** processor only as of the last option. If not matche is found for given request, the server MUST respond with a `SIP 405: Method Not Allowed.`

> The Router component does not manipulate the SIP Messages in anyway.

**Functional Requirements**

**Non-functional Requirements**

**Service Configuration**

<details>
<summary>Schema</summary>
 
```json
// TODO
```
 
</details>

<details>
<summary>Example</summary>

```json
{
  "kind": "Router",
  "apiVersion": "v2beta1",
  "metadata": {
    "ref": "rt001"
  },
  "spec": {
    "bindAddr": "0.0.0.0",
    "processors": [
      {
        "id": "fallback-processor",
        "isFallback": true,
        "addr": "192.168.1.121:56001",
        "methods": [
          "REGISTER",
          "MESSAGE",
          "INVITE",
          "CANCEL",
          "..."
        ],
        "matchFunc": "(req, res) => true\n"
      },
      {
        "id": "scaip-essense",
        "addr": "192.168.1.122:56001",
        "methods": [
          "MESSAGE"
        ],
        "matchFunc": "(req, res) => { return req.method === 'MESSAGE' && req.agent.search(/pattern/) !== -1}"
      }
    ]
  }
}
```

</details>

**Communication with Adjacent Services**

**Test Criteria**

**Special Considerantions**

None

### Message Processor

Message Processors are small services that carry the logic for the manipulation of SIP messages. A processor will be responsible for one or more of the following tasks:

1. Authenticate Request
2. Authorize Request
3. Valid Request
4. Process Request

The normal processing flow of a request is:

Interface Pseudocode:

```text
=> Message Processor Matched (by Message Router)
  => isValid (request) or return Bad Request (400) 
  => isAuthenticated(request) or send Authentication Challenge
  => isAuthorized(request) or send is Unauthorized
  => doProcess(request) and return upadted request
```

Any action no covered by *isValid*, *isAuthenticated*, *isAuthorized* will go into *doProcess**. For example, allocation the correct RTPEngine or feeding external logging system.

**Passing multiple EdgePort(s)**

A Message Processor must coordinate with the *LocationAPI* and other APIs to determine the nexthop. Sometimes the signaling path would include multiple EdgePort(s).

Consider the following scenario:

1. SIP Client A Registered to Routr via the EdgePort 001 (EP1)
2. SIP Client B Registered to Routr via the EdgePort 002 (EP2)

To correctly forward and INVITE from `A` to `B`, a Message Processor must obtain enough information from the *LocationAPI* to know how to properly route the call.

For this scenario the flow would look like this: `A -> EP1 -> EP2 -> B`

**Balancing Backends**

Some scenarios require sending requests to a specific backend. To balance the load between those backends we will implement a load balancing logic in the *LocationService*. Consider the following scenario:

`Scenario 1:`

You want to balance the load for a Voice Application service. Voice Applications live in one or more Media Servers (Asterisk for example). 

To balance the load between the Media Servers, we need to create a binding between the `call-id` and a backend for the first Request on a Dialog. All subsequent requests will be sent to the same backend.

We MUST have a mechanism to identify the load balancing group during the Registration process of each backend. For example, we could use the custom header `X-Fonoster-Backend: VOICEAPP` to mark all of the backends responsible for Voice Applications.

`Scenario 2:`

The second scenario is for *Conference* services. As before, we need to identify the correct backend. We might use a similar approach by adding a custom header `X-Fonoster-Backend: CONFERENCE` which will later be used by the *LocationAPI* to obtain an instance of the backend.

**Directing Request to a Backend**

To make the later scenario possible, both Numbers and Agents will require additional metadata. For example, to indicate that a Number must be directed to a Voice application, we could use the following:

```json
{
  "apiVersion": "v1beta1",
  "kind": "Number",
  "metadata": {
    "ref": "Number0001",
    "gwRef": "GW0001",
    "geoInfo": {
      "city": "Columbus, GA",
      "country": "USA",
      "countryISOCode": "US"
    }
  },
  "spec": {
    "location": {
      "telUrl": "tel:17066041487"
    },
    "next": {
      "backend": "CONFERENCE",
      "ref": "work-conference"
    }
  }
}
```

> Next COULD have the `aorLink` if the desired behavior is to point to an specific instance
