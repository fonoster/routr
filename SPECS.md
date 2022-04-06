# Routr Specification

### Version 0.1.2 (Draft)

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
  * [Message Dispatcher](#message-dispatcher)
  * [Message Processor](#message-processor)
  * [Data APIs](#data-apis)

<!-- tocstop -->

</details>

## Introduction

### Document Conventions 

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in the [specification](./SPECS.md) are to be interpreted as described in [BCP 14](https://tools.ietf.org/html/bcp14) [[RFC2119](https://tools.ietf.org/html/rfc2119)] [[RFC8174](https://tools.ietf.org/html/rfc8174)] when, and only when, they appear in all capitals, as shown here.

### Purpose

The purpose of this document is to present a detailed description of the SIP Server *Routr*. It will explain the purpose and features of the system, the interfaces of the system, what the system will do, the constraints under which it must operate, and how the system will react to external stimuli. This document is intended for both the stakeholders and the developers of the system.

### Scope of Project

This software system will be a SIP Server that cares for the signaling as a standalone system or as part of a broader one. The specification aims for a design that maximizes scalability and extensibility by making use of a microservice architecture which was a challenging factor on **v1**. By using a microservice architecture we will ensure that portions of the system be able to be deployed independently, and each treated according to its problem domain.

More specifically, this system will be designed to allow for the separation of concerns within the logical components of a SIP Server. The software MUST be able to accept SIP Messages via *UDP*, *TCP*, *TLS*, *WS*, and *WSS*. It should then, transform the messages efficiently and facilitate the communication between the various components.

Furthermore, the system MUST include a mechanism to replace the SIP Message processing without updating the entire system. It should also facilitate communication with external systems for Authentication, Authorization, and Accounting (AAA) and allow to host multiple tenants thru the use of a Role-based Access Control (RBAC) system.

### Glossary

|  | Description |
| ----------- | ----------- |
| *Backend Service* | A service that provides a use-case or capability for the overall system (i.e Asterisk or FreeSWITCH) |
| *SIP Client* | A SIP Client is any SIP capable device or software that communicates thru *Routr* |
| *Role-Based Access Control (RBAC)* |  Mechanism that restricts access to parts of Routr based on a user's role and resource ownership |
| *SIP Server* | Also known as a SIP Proxy, deals with all the management of SIP requests in a network and is responsible for taking requests from the SIP Clients to place and terminate calls and process other types of requests |
| *gRPC* | Is a modern open-source high performance Remote Procedure Call (RPC) framework |
| *Stakeholder* |Any person with an interest in the project who is not a developer |
| *Nexthop* | The next network element within the signaling path of a given request |
| *M.E.L.T* | M.E.L.T stands for Metrics, Events, Logs, Tracing |

### References

IEEE/ISO/IEC 29148-2018 - ISO/IEC/IEEE International Standard - Systems and software engineering -- Life cycle processes -- Requirements engineering

## Requirements Specification

<!--
Diagram generated with: https://arthursonzogni.com/Diagon/#GraphDAG
Raw Diagram:
 EdgePort 001 -> Message Dispatcher
 EdgePort 002 -> Message Dispatcher
 Message Dispatcher -> SCAIP Processor
 Message Dispatcher -> Connect Processor
 Message Dispatcher -> Twilio Processor
 SCAIP Processor -> Data APIs & External Services
-->

```none
┌────────────┐┌────────────┐                           
│EdgePort 001││EdgePort 002│                           
└┬───────────┘└┬───────────┘                           
┌▽─────────────▽───────────────────────┐               
│Message Dispatcher                    │               
└┬────────────────┬───────────────────┬┘               
┌▽──────────────┐┌▽─────────────────┐┌▽───────────────┐
│SCAIP Processor││Connect Processor ││Twilio Processor│
└┬──────────────┘└──────────────────┘└────────────────┘
┌▽────────────────────────────┐                        
│Data APIs & External Services│                        
└─────────────────────────────┘                        
```

The SIP Server "Routr" has three main components and one cooperating service. The first component, the EdgePort, is responsible for accepting SIP Messages parsing them into protobuf, and sending them to the Message Dispatcher. After a SIP Message is processed, the EdgePort will forward the SIP Message to the nexthop.

The job of *Message Dispatcher* is to accept SIP Messages encapsulated as protobuf from the EdgePort, and routing the SIP Message to and from the Message Processor.

*Message Processor(s)* is responsible for the authentication, validation, and processing of SIP Messages, as well as updating the SIP Messages so that they can reach their destination.

*Middleware(s)* are optional components that cooperate to bring plugable behaviors to the service. A middleware maybe configured to modify request (e.g RTPEngine Middleware) or read a request for observability reasons.  

### EdgePort

<!--
Diagram generated with: https://arthursonzogni.com/Diagon/#Sequence
Raw Diagram:
  SIP Client -> EdgePort: SIP Request
  EdgePort -> Message Dispatcher: gRPC Request
  EdgePort <- Message Dispatcher: gRPC Response
  SIP Client <- EdgePort: SIP Response
-->

```none
 ┌──────────┐  ┌────────┐ ┌──────────────────┐
 │SIP Client│  │EdgePort│ │Message Dispatcher│
 └────┬─────┘  └───┬────┘ └──────┬───────────┘
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
 ┌────┴─────┐  ┌───┴────┐ ┌──────┴───────────┐
 │SIP Client│  │EdgePort│ │Message Dispatcher│
 └──────────┘  └────────┘ └──────────────────┘
```

**Brief Description**

The EdgePort component is a service that sits at the edge of the network. The job of the EdgePort is to receive SIP Messages, convert them to protobuf and forward them downstream for processing. A *Routr* network might have multiple EdgePorts.

**Functional Requirements**

The following functions are Must have for an implementation of an *EdgePort*:

- *Accept SIP Msg* - Accept Messages using as transport UDP, TCP, TLS, WS, and WSS
- *Accept SIP Msg (Part2)* - Accept Messages on some or all network interfaces
- *Transform SIP Msg* - Transform Messages to protobuf
- *Keep Msg's state* - MUST keep the state until the Message is processed or a timeout occurs
- *Reject Msgs from banned IPs* - MUST have a mechanism to identify and discard unwanted Messages
- *Health Check* - MUST have a mechanism to identify the health of the service
- *M.E.L.T* - Must be capable of collecting and sending M.E.L.T to external systems
- *Service Port* - The ports use for SIP signaling will default to traditional values (eg. 5060, 5061, etc)

**Non-functional Requirements**

The following requirements are important to have for an implementation of an *EdgePort*:

- *Transformation Time* -  Msg transformation time efficiency should be < *TBT*
- *Msg Processed/second* - Should be able to process *TBT* number of Msg per second
- *Recoverability* - Recover from an unhealthy state


**Service Configuration**

The configuration for the *EdgePort* could be represented as JSON or YAML formats, however, internal use and validation will be done as per [https://json-schema.org](https://json-schema.org/learn/getting-started-step-by-step). The following example, summarizes de configuration REQUIRED by the *EdgePort*:

```json
{
  "kind": "EdgePort",
  "apiVersionv": "v2draft1",
  "metadata": {
    "ref": "ep001",
    "region": "us-east1"
  },
  "spec": {
    "bindAddr": "0.0.0.0",
    "processor": {
      "addr": "dispatcher:51901"
    },
    "externalIps": ["165.227.217.102"],
    "localnets": ["172.17.0.2/16"],
    "methods": [
      "INVITE",
      "MESSAGE",
      "REGISTER"
    ],
    "unknownMethodAction": "Discard"
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
  "$id": "https://json-schema.org/draft/2020-12/schema",
  "title": "EdgPort configuration",
  "description": "Configuration for an EdgePort instance",
  "type": "object",
  "properties": {
    "kind": {
      "description": "Resouce type",
      "type": "string"
    },
    "apiVersion": {
      "enum": ["v2draft1", "v2.0", "v2"]
    },
    "metadata": {
      "description": "Resource metadata",
      "type": "object",
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
      "required": ["ref"]
    },
    "spec": {
      "description": "Operation spec for the EdgePort",
      "type": "object",
      "properties": {
        "bindAddr": {
          "description": "Ipv4 interface to accept request on",
          "type": "string"
        },
        "externalIps": {
          "description": "EdgePort external ip addresses.",
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true,
          "minItems": 1,
        },
        "localnets": {
          "description": "Networks considered to be local",
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true,
          "minItems": 1,
        },
        "methods": {
          "description": "Acceptable SIP Methods",
          "type": "array",
          "items": {
            "type": "string"
          },
          "uniqueItems": true
        },
        "unknownMethodAction": {
          "description": "What to do if an incomming request type is not allowed",
          "enum": ["Discard", "Respond"]
        },
        "transport": {
          "description": "Acceptable Transport Protocols",
          "type": "array",
          "items": {
            "type": "object"
          },
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
          },
          "required": ["port", "protocol"]
        },
        "processor": {
          "description": "Adjacent service for message routing",
          "type": "object",
          "properties": {
            "addr": {
              "type": "string"
            }
          }
        }
      },
      "required": ["methods", "transport", "processor"]
    },
  },
  "required": ["kind", "metadata", "spec", "apiVersion"]
}
```
</details>

**Communication with Adjacent Services**

Adjacent to the *EdgePort* is the *Message Dispatcher*. The communication between these two services is done using gRPC and protobuf.

<details>
<summary>Message Proto</summary>

```proto 
... 
 
message SIPMessage {
  oneof message_type {
    ResponseType response_type = 1;
    SipURI request_uri = 2;
  }
  From from = 3;
  To to = 4;
  Contact contact = 5;
  CallID call_id = 6;
  ContentLength content_length = 7;
  Expires expires = 8;
  repeated Via via = 9;
  repeated Extension extensions = 10;
  WWWAuthenticate www_authenticate = 11;
  Authorization authorization = 12;
}
 
...
```

</details>

**Test Criteria**

The *EdgePort* MUST pass all the tests prescribed in chapter *1.x* of the `SIP Connect v1.1`. Additionally, the *EdgePort* MUST pass the following tests:

1. Routing INVITE messages for SIP Clients located at separate *EdgePorts*
2. Signaling for popular WebRTC clients

**Security Considerations**

Since the *EdgePort* sits at the edge of the network, it's crucial that is capable of withstanding typical SIP attacks. On SIP over TCP or TLS, the server should avoid descriptors resource exhaustion, especially during a SIP INVITE flood attack. Consider also, monitoring and alerting for CPU and/or memory usage needed to handle SIP sessions and dialog, to not exceed the resources available. Finally, the server should drop any malformed SIP messages and avoid filling up the log files or logging servers. 

**Special Considerations**

Running the *EdgePort* in cloud environment, such as Kubernetes, can be challenging. Keep the following in mind when deploying to Kubernetes:

1. Kubernetes' load balancers are not designed to work with SIP 
2. The EdgePort uses the SIP protocol which requires L7 load balancers
3. A complex network topology could disrupt the service and create latency

### Message Dispatcher

```none
 ┌────────┐ ┌──────────────────┐             ┌─────────────────┐
 │EdgePort│ │Message Dispatcher│             │Message Processor│
 └───┬────┘ └──────┬───────────┘             └────────┬────────┘
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
 ┌───┴────┐ ┌──────┴───────────┐             ┌────────┴────────┐
 │EdgePort│ │Message Dispatcher│             │Message Processor│
 └────────┘ └──────────────────┘             └─────────────────┘
```

**Brief Description**

The *Message Dispatcher* component takes a SIP message and forwards them to the corresponding Message Processor. The matching process is done using the request coming from the *EdgePort*.

The *Message Dispatcher* will always use the first processor that matches a request. If no match is found for the given request, the server MUST respond with a `SIP 405: Method Not Allowed.` The *Message Dispatcher* component does not manipulate the SIP Messages in any way.

**Functional Requirements**

The following functions are MUST have for an implementation of a *Message Dispatcher*:

- *Stateless Service* - The service must be built in such a way to allow for scalability
- *Accept gRPC Requests* - Accept gRPC Requests
- *Find Processor* - Find a processor that matches a given request
- *Forward Requests using gRPC* - Send the requests to the corresponding *Message Processor*
- *Return processed Message* - Routes the processed message back to the *EdgePort*
- *Health Check* - MUST have a mechanism to identify the health of the service
- *M.E.L.T* - Must be capable of collecting and sending M.E.L.T to external systems
- *System Unavailable* - It must return a `SIP 503 Service Unavailable` if the matched *Message Processor* is unreachable
- *Service Port* - The default gRPC port at the Message Dispatcher SHOULD be `51901`

**Non-functional Requirements**

The following requirements are important to have for an implementation of a *Message Dispatcher*:

- *Msg Processed/second* - Should be able to process *TBT* number of Msg per second
- *Recoverability* - Recover from an unhealthy state

**Service Configuration**

Example: 
```json
{
  "kind": "MessageDispatcher",
  "apiVersion": "v2draft1",
  "metadata": {
    "ref": "mr001"
  },
  "spec": {
    "bindAddr": "0.0.0.0",
    "middlewares": [
      {
        "ref": "mid01",
        "addr": "middleware01:51903"
      },
      {
        "ref": "mid02",
        "addr": "middleware02:51903"
      }
    ],
    "processors": [
      {
        "ref": "scaip-essense",
        "addr": "scaipessense:51903",
        "methods": [
          "MESSAGE"
        ],
        "matchFunc": "req => req.method === 'MESSAGE'"
      },
      {
        "ref": "connect-processor",
        "addr": "connect:51903",
        "methods": [
          "REGISTER",
          "MESSAGE",
          "INVITE",
          "CANCEL"
        ],
        "matchFunc": "req => true"
      }
    ]
  }
}
```

<details>
<summary>Schema</summary>
 
```json
{
  "$id": "https://json-schema.org/draft/2020-12/schema",
  "title": "Message Dispatcher configuration",
  "description": "Configuration for a Message Dispatcher instance",
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
      "type": "object",
      "properties": {
         "ref": {
           "description": "EdgePort reference",
           "type": "string"
         }
       },
      "required": [ "ref" ]
    },
    "spec": {
      "description": "Operations spec for EdgePort",
      "type": "object",
      "properties": {
         "bindAddr": {
           "description": "Ipv4 interface to accept request on",
           "type": "string"
         },
         "middlewares": {
           "description": "Middleware Processors",
           "type": "array",
           "items": {
             "type": "object"
           },
           "properties": {
             "ref": {
               "type": "string"
             },
             "addr": {
               "type": "string"
             }
           },
           "required": [ "ref", "addr" ]
         },
         "processors": {
           "description": "Message Processors",
           "type": "array",
           "items": {
             "type": "object"
           },
           "properties": {
             "ref": {
               "type": "string"
             },
             "addr": {
               "type": "string"
             },
             "matchFunc": {
               "type": "string"
             },
             "methods": {
               "type": "array",
               "items": {
                 "type": "string"
               }
             }
           },
           "required": [ "ref", "addr", "methods", "matchFunc" ]
         }
       },
      "required": [ "ref" ]
    }    
  },
  "required": [ "kind", "metadata", "spec", "apiVersion" ]
}
``` 
</details>

**Communication with Adjacent Services**

The adjacent services of the *Message Dispatcher* are the *EdgePort* and the *Message Processor*. The communication with all adjacent services is done with gRPC and protobuf. The `processor.proto` contains the following code:

```proto
syntax = "proto3";

package fonoster.routr.processor.v2draft1;

// Processor service
service Processor {
  // Process Message Request
  rpc ProcessMessage (MessageRequest) returns (MessageResponse) {}
}
```

The *Message Dispatcher* expects that *Message Procesor(s)* have the same interface.

**Test Criteria**

MUST have Unit Tests to validate its basic functionalities. MUST have Integration Tests with all Adjacent Services. 

**Special Considerations**

None

### Message Processor

**Brief Description**

Message Processors are small services that carry the logic to manipulate SIP Messages.

**Functional Requirements**

A processor will be responsible for one or more of the following tasks:

1. Authenticate Message
2. Authorize Message
3. Validate Message
4. Process Message

Interface Pseudocode:

```text
=> Message Processor Matched (by Message Dispatcher)
  => isValid (message) or return Bad Request (400) 
  => isAuthenticated(message) or send Authentication Challenge
  => isAuthorized(message) or send is Unauthorized
  => doProcess(message) and return updated request/response
```

> The default gRPC port at the Message Processor is SHOULD be `51901`.

**Non-functional Requirements**

The following requirements are important to have for an implementation of a *Message Processor*:

- *Msg Processed/second* - Should be able to process *TBT* number of Msg per second
- *Recoverability* - Recover from an unhealthy state

**Service Configuration**

Each Message Processor can have its own configuration based on the use case.

However, the following "base" configuration, is recommend as the starting point for your processor's configuration.

```json
{
  "kind": "Processor",
  "apiVersion": "v2draft1",
  "metadata": {
    "ref": "logging-processor"
    "region": "us-east1"
  },
  "spec": {
    "bindAddr": "0.0.0.0"
  }
}
```

**Communication with Adjacent Services**

Adjacent to the *Message Processor* is the *Message Dispatcher*. The communication flows from the *Message Dispatcher* to the *Message Processor*, where the *Message Processor* is the server and *Message Dispatcher* is the client. A *Message Processor* MUST have the following protobuf interface:

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

**Security Consideration**

None.

### Location Service and API (TODO)

**Brief Description**
**Functional Requirements**

*Service Port* - The default gRPC port at the Location Service SHOULD be `51902`

**Non-functional Requirements**
**Service Configuration**
**Communication with Adjacent Services**
**Test Criteria**
**Security Consideration**

<details>
<summary>Passing multiple EdgePort(s)</summary>
A Message Processor must coordinate with the LocationAPI and other APIs to determine the nexthop. Sometimes the signaling path would include multiple EdgePort(s).

Consider the following scenario:

1. SIP Client A Registered to Routr via the EdgePort 001 (EP1)
2. SIP Client B Registered to Routr via the EdgePort 002 (EP2)

To correctly forward and INVITE from `A` to `B`, a Message Processor must obtain enough information from the LocationAPI to know how to properly route the call.

For this scenario the flow would look like this: `A -> EP1 -> EP2 -> B`
</details>
 
<details>
<summary>Balancing Backends</summary>
Some scenarios require sending requests to a specific backend. To balance the load between those backends we will implement a load balancing logic in the *LocationService*. Consider the following scenario:

Scenario #1:

You want to balance the load for a Voice Application service. Voice Applications live in one or more Media Servers (Asterisk for example). 

To balance the load between the Media Servers, a binding between the `call-id` and a backend must be created for the first Request on a Dialog. All subsequent requests will be sent to the same backend.

Routr MUST have a mechanism to identify the load balancing group during the Registration process of each backend. For example, it could use a custom header such as `X-Fonoster-Backend: VOICEAPP` to mark all of the backends responsible for Voice Applications.

Scenario #2:

The second scenario is for *Conference* services. As before, Routr must identify the correct backend. For that, it might use a similar approach by adding a custom header `X-Fonoster-Backend: CONFERENCE` which will later be used by the LocationAPI to obtain an instance of the backend. However, since all parties in conference must connect with the same backed an additional feature will be needed to mark the backend for session affinity.
 
</details>
 
<details>
<summary>Directing Request to a Backend</summary>
To make the later scenario possible, both Numbers and Agents will require additional metadata. For example, to indicate that a Number must be directed to a Voice application, an implementation could use the following:

```json
{
  "apiVersion": "v2draft1",
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

> The "next" section COULD have the `aorLink` if the desired behavior is to point to a specific instance
</details>
