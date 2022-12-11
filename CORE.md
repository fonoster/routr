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
    * [Location Service](#location-service)

<!-- tocstop -->

</details>

## Introduction

### Document Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT
RECOMMENDED", "MAY", and "OPTIONAL" in the [specification](./SPECS.md) are to be interpreted as described
in [BCP 14](https://tools.ietf.org/html/bcp14) [[RFC2119](https://tools.ietf.org/html/rfc2119)] [[RFC8174](https://tools.ietf.org/html/rfc8174)]
when, and only when, they appear in all capitals, as shown here.

### Purpose

This document aims to present a detailed description of the SIP Server *Routr*. It will explain the purpose and features
of the system, the interfaces of the system, what the system will do, the constraints under which it must operate, and
how the system will react to external stimuli. This document is intended for the system's stakeholders and developers.

### Scope of Project

This software system will be a SIP Server that cares for the signaling as a standalone system or as part of a broader one. The specification aims for a design that maximizes scalability and extensibility. It uses a microservice architecture which was a challenging factor on **v1**.

We will use a microservice architecture to ensure that portions of the system can be deployed independently and treated according to its problem domain.

More specifically, this system will be designed to allow for the separation of concerns within the logical components of
a SIP Server. The software MUST be able to accept SIP Messages via *UDP*, *TCP*, *TLS*, *WS*, and *WSS*. It should transform the messages efficiently and facilitate communication between the various components.

Furthermore, the system MUST include a mechanism to replace the SIP Message processing without updating the entire system. It should also facilitate communication with external systems for Authentication, Authorization, and Accounting (AAA) and allow to host of multiple tenants by using a Role-based Access Control (RBAC) system.

### Glossary

|  | Description |
| ----------- | ----------- |
| *Backend Service* | A service that provides a use-case or capability for the overall system (e.g., Asterisk or FreeSWITCH) |
| *SIP Client* | A SIP Client is any SIP-capable device or software that communicates thru *Routr* |
| *Role-Based Access Control (RBAC)* |  Mechanism that restricts access to parts of Routr based on a user's role and resource ownership |
| *SIP Server* | Also known as a SIP Proxy, deals with all the management of SIP requests in a network and is responsible for taking requests from the SIP Clients to place and terminate calls and process other types of requests |
| *gRPC* | Is a modern open-source, high-performance Remote Procedure Call (RPC) framework |
| *Stakeholder* |Any person with interest in the project which is not a developer |
| *Nexthop* | The next network element within the signaling path of a given request |
| *M.E.L.T* | M.E.L.T stands for Metrics, Events, Logs, Tracing |

### References

IEEE/ISO/IEC 29148-2018 - ISO/IEC/IEEE International Standard - Systems and software engineering -- Life cycle processes
-- Requirements engineering

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

The SIP Server "Routr" has three main components and one cooperating service. The first component, the EdgePort, is
responsible for accepting SIP Messages, parsing them into protobuf, and sending them to the Message Dispatcher. After a
SIP Message is processed, and the EdgePort will forward the SIP Message to the next hop.

The job of *Message Dispatcher* is to accept SIP Messages encapsulated as protobuf from the EdgePort, and route the
SIP Message to and from the Message Processor.

*Message Processor(s)* is responsible for the authentication, validation, and processing of SIP Messages. They are also
in charge of updating the SIP Messages to reach their destination.

*Middleware(s)* are optional components that cooperate to bring pluggable behaviors to the service. Middlewares may be
configured to modify requests (e.g., RTPEngine Middleware) or read them for observability.

### EdgePort

<!--
Diagram generated with: https://arthursonzogni.com/Diagon/#Sequence
Raw Diagram:
  SIP Client -> EdgePort: SIP request
  EdgePort -> Message Dispatcher: gRPC request
  EdgePort <- Message Dispatcher: gRPC Response
  SIP Client <- EdgePort: SIP Response
-->

```none
 ┌──────────┐  ┌────────┐ ┌──────────────────┐
 │SIP Client│  │EdgePort│ │Message Dispatcher│
 └────┬─────┘  └───┬────┘ └──────┬───────────┘
      │            │             │        
      │SIP request │             │        
      │───────────>│             │        
      │            │             │        
      │            │gRPC request │        
      │            │────────────>│        
      │            │             │        
      │            │gRPC response│        
      │            │<────────────│        
      │            │             │        
      │SIP response│             │        
      │<───────────│             │        
 ┌────┴─────┐  ┌───┴────┐ ┌──────┴───────────┐
 │SIP Client│  │EdgePort│ │Message Dispatcher│
 └──────────┘  └────────┘ └──────────────────┘
```

**Brief Description**

The EdgePort component is a service that sits at the network's edge. The job of the EdgePort is to receive SIP Messages,
convert them to protobuf and forward them downstream for processing. A *Routr* network might have multiple EdgePorts.

**Functional Requirements**

The following functions are essential for an implementation of an *EdgePort*:

- *Accept SIP Msg* - Accept Messages using transport UDP, TCP, TLS, WS, and WSS
- *Accept SIP Msg (Part2)* - Accept Messages on some or all network interfaces
- *Transform SIP Msg* - Transform Messages to protobuf
- *Keep Msg's state* - MUST keep the state until the message is processed or a timeout occurs
- *Reject Msgs from banned IPs* - MUST have a mechanism to identify and discard unwanted Messages
- *Health Check* - MUST have a mechanism to identify the health of the service
- *M.E.L.T* - Must be capable of collecting and sending M.E.L.T to external systems
- *Service Port* - The ports for SIP signaling will default to traditional values (e.g., 5060, 5061, etc.)

**Non-functional Requirements**

The following requirements are essential to have for an implementation of an *EdgePort*:

- *Transformation Time* - Msg transformation time efficiency should be < *TBT*
- *Msg Processed/second* - Should be able to process *TBT* number of Msg per second
- *Recoverability* - Recover from an unhealthy state

**Service Configuration**

The configuration for the *EdgePort* could be represented as JSON or YAML formats. However, internal use and validation will use [https://json-schema.org](https://json-schema.org/learn/getting-started-step-by-step). The following example summarizes de configuration REQUIRED by the *EdgePort*:

```json
{
  "apiVersion": "v2draft1",
  "kind": "EdgePort",
  "ref": "ep001",
  "metadata": {
    "region": "us-east1"
  },
  "spec": {
    "bindAddr": "0.0.0.0",
    "processor": {
      "addr": "dispatcher:51901"
    },
    "externalAddrs": ["165.227.217.102"],
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
    "apiVersion": {
      "enum": ["v2draft1", "v2.0", "v2"]
    },
    "kind": {
      "description": "Resouce type",
      "type": "string"
    },
    "ref": {
      "description": "EdgePort reference",
      "type": "string"
    },
    "metadata": {
      "description": "Resource metadata",
      "type": "object",
      "properties": {
        "region": {
          "description": "Optional region where the EdgePort is operating",
          "type": "string"
        }
      }
    },
    "spec": {
      "description": "Operation spec for the EdgePort",
      "type": "object",
      "properties": {
        "bindAddr": {
          "description": "Ipv4 interface to accept request on",
          "type": "string"
        },
        "externalAddrs": {
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
          "description": "What to do if an incoming request type is not allowed",
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
  "required": [ "apiVersion", "kind", "ref", "metadata", "spec" ]
}
```

</details>

**Communication with Adjacent Services**

Adjacent to the *EdgePort* is the *Message Dispatcher*. The communication between these two services is done using gRPC
and protobuf.

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

The *EdgePort* MUST pass all the tests prescribed in chapter *1.x* of the `SIP Connect v1.1`. Additionally, the *
EdgePort* MUST pass the following tests:

1. Routing INVITE messages for SIP Clients located at separate *EdgePorts*
2. Signaling for popular WebRTC clients

**Security Considerations**

Since the *EdgePort* sits at the edge of the network, it must be capable of withstanding typical SIP attacks. On SIP
over TCP or TLS, the server should avoid descriptors resource exhaustion, especially during a SIP INVITE flood attack.
Consider monitoring and alerting for CPU and memory usage needed to handle SIP sessions and dialog, staying within the
resources available. Finally, the server should drop any malformed SIP messages and avoid filling up the log files or
logging servers.

**Special Considerations**

Running the *EdgePort* in a cloud environment like Kubernetes can be challenging. Keep the following in mind when
deploying to Kubernetes:

1. Kubernetes' load balancers are not designed to work with SIP
2. The EdgePort uses the SIP protocol, which requires L7 load balancers
3. A complex network topology could disrupt the service and create latency

### Message Dispatcher

```none
 ┌────────┐ ┌──────────────────┐             ┌─────────────────┐
 │EdgePort│ │Message Dispatcher│             │Message Processor│
 └───┬────┘ └──────┬───────────┘             └────────┬────────┘
     │             │                                  │         
     │gRPC request │                                  │         
     │────────────>│                                  │         
     │             │                                  │         
     │             │findProcessor() & forwardMessage()│         
     │             │─────────────────────────────────>│         
     │             │                                  │         
     │             │        Processed Message         │         
     │             │<─────────────────────────────────│         
     │             │                                  │         
     │gRPC response│                                  │         
     │<────────────│                                  │         
 ┌───┴────┐ ┌──────┴───────────┐             ┌────────┴────────┐
 │EdgePort│ │Message Dispatcher│             │Message Processor│
 └────────┘ └──────────────────┘             └─────────────────┘
```

**Brief Description**

The *Message Dispatcher* component takes a SIP message and forwards them to the corresponding Message Processor. The the matching process is done using the request from the *EdgePort*.

The *Message Dispatcher* will always use the first Processor that matches a request. If no match is found for the given request, the server MUST respond with a `SIP 405: Method Not Allowed.` The *Message Dispatcher* component does not manipulate the SIP Messages.

**Functional Requirements**

The following functions are MUST have for an implementation of a *Message Dispatcher*:

- *Stateless Service* - The service must be built in such a way to allow for scalability
- *Accept gRPC Requests* - Accept gRPC Requests
- *Find Processor* - Find a processor that matches a given request
- *Forward Requests using gRPC* - Send the requests to the corresponding *Message Processor*
- *Return processed Message* - Routes the processed message back to the *EdgePort*
- *Health Check* - MUST have a mechanism to identify the health of the service
- *M.E.L.T* - Must be capable of collecting and sending M.E.L.T to external systems
- *System Unavailable* - It must return a `SIP 503 Service Unavailable` if the matched *Message Processor* is
  unreachable
- *Service Port* - The default gRPC port at the Message Dispatcher SHOULD be `51901`

**Non-functional Requirements**

The following requirements are essential to have for an implementation of a *Message Dispatcher*:

- *Msg Processed/second* - Should be able to process *TBT* number of Msg per second
- *Recoverability* - Recover from an unhealthy state

**Service Configuration**

Example:

```json
{
  "kind": "MessageDispatcher",
  "apiVersion": "v2draft1",
  "ref": "mr001",
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
    "apiVersion": {
      "description": "Resource version",
      "type": "string"
    },
    "kind": {
      "description": "Resouce type",
      "type": "string"
    },
    "ref": {
      "description": "EdgePort reference",
      "type": "string"
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
       }
    }    
  },
  "required": [ "apiVersion", "kind", "ref", "metadata", "spec" ]
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

The following requirements are essential to have to a *Message Processor*:

- *Msg Processed/second* - Should be able to process *TBT* number of Msg per second
- *Recoverability* - Recover from an unhealthy state

**Service Configuration**

Each Message Processor can have its own configuration based on the use case.

However, the following "base" configuration is recommended as the starting point for your Processor's design.

```json
{
  "kind": "Processor",
  "apiVersion": "v2draft1",
  "ref": "logging-processor",
  "metadata": {
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

### Location Service

**Brief Description**

The Location Service(LS) stores routing information for all participating endpoints. A Processor can later retrieve the route and learn how to reach the endpoint.

The proto definition for the LS route includes all necessary information to reach a target endpoint, including the `host`, `port` `transport`, and ingress `listening_point.`

Suppose an endpoint participating as "backend" wishes to use the `least-sessions` balancing algorithm. In that case, it must report the number of active sessions using the `session_count` field. The session count could come in the form of a header (e.g.: `X-Session-Count`).

> For a complete picture of the routing, the `listening_point` of the originating endpoint must be taken into account.
> This information is present on all requests arriving at a Processor.

Route DTO:

```proto
// A binding create by an actual endpoint (Softphone, PBX, Conference System, etc.)
message Route {
  string user = 1;
  string host = 2;
  string port = 3;
  fonoster.routr.common.v2draft1.Transport transport = 4;
  int64 registered_on = 5;
  int32 expires = 6;
  int32 session_count = 7;
  string edge_port_ref = 8;
  fonoster.routr.processor.v2draft1.NetInterface egress_listening_point = 9;
  // During route creation, an endpoint can request to add labels that can later be
  // used as selectors. For example, a Softphone can add the label `priority=1` to indicate
  // that it is the preferred endpoint for the given AOR.
  map<string, string> labels = 10;
}
```

**Functional Requirements**

The following functions are MUST have for an implementation of a *Location Service*:

- *Stateless Service* - The service must be built in such a way as to allow for scalability
- *Accept gRPC Requests* - Accept gRPC Requests
- *Find Routes* - Find all the routes to an endpoint
- *Filtering Labels* - MUST be able to store endpoints using labels (for filtering)
- *Backend or Endpoint* - MUST allow AOR the "sip:" and "backend:" schemes
- *Balancing Algorithm* - Implements `round-robin` and `least-sessions`
- *Session Affinity* - Implements session base affinity
- *Cache* - Caching must be done via "providers" that are easily replaceable (e.g.: `Memory`, `Redis`, etc.)
- *Health Check* - MUST have a mechanism to identify the health of the service
- *M.E.L.T* - Must be capable of collecting and sending M.E.L.T to external systems
- *Service Port* - The default gRPC port at the Location Service SHOULD be `51902`

**Non-functional Requirements**

The following requirements are essential to have for an implementation of a *Location Service*:

- *Msg Processed/second* - Should be able to process *TBT* number of Msg per second
- *Recoverability* - Recover from an unhealthy state

**Service Configuration**

Example:

```json
{
  "kind": "Location",
  "apiVersion": "v2draft1",
  "metadata": {
    "region": "us-east1"
  },
  "spec": {
    "bindAddr": "0.0.0.0:51902",
    "cache": {
      "provider": "memory"
    },
    "backends": [
      {
        "ref": "voice"
      },
      {
        "ref": "conference",
        "balancingAlgorithm": "least-sessions",
        "withSessionAffinity": true
      }
    ]    
  }
}
```

> Notice that using the `memory` provider will only work for simple cases where you run a single instance of the
> Location Service. Suppose you need the `least-session` algorithm and run multiple instances of the Location Service. In
> that case, you will need a distributed provider such as `Redis.`

<details>
<summary>Schema</summary>

```json
{
  "$id": "https://json-schema.org/draft/2020-12/schema",
  "title": "Location Service configuration",
  "description": "Configuration for an instance of the Location Service",
  "type": "object",
  "properties": {
    "kind": {
      "enum": ["Location", "location"]
    },
    "apiVersion": {
      "enum": ["v2draft1"]
    },
    "metadata": {
      "description": "Resource metadata",
      "type": "object"
    },
    "spec": {
      "description": "Operations spec for Location",
      "type": "object",
      "properties": {
        "bindAddr": {
          "description": "Ipv4 interface to accept request on",
          "type": "string"
        },
        "cache": {
          "type": "object",
          "properties": {
            "provider": {
              "enum": ["memory", "redis"]
            },
            "parameters": {
              "type": "string"
            },
          },
          "required": ["provider"]
        },
        "backends": {
          "description": "Optional SIP backends",
          "type": "array",
          "items": {
            "type": "object"
          },
          "properties": {
            "ref": {
              "type": "string"
            },
            "balancingAlgorithm": {
              "enum": ["round-robin", "least-sessions"]
            },
            "sessionAffinity": {
              "description": "Optional session affinity",
              "type": "object",
              "properties": {
                "enabled": {
                  "type": "boolean"
                },
                "ref": {
                  "type": "string"
                }
              },
              "required": ["ref"]
            },
          },
          "required": ["ref"]
        },
      }
    }
  },
  "required": [ "apiVersion", "kind", "metadata", "spec" ]
}
```

</details>

**Communication with Adjacent Services**

```proto
syntax = "proto3";

package fonoster.routr.location.v2draft1;

service Location {
  rpc AddRoute (AddRouteRequest) returns (Empty) {}
  rpc FindRoutes (FindRoutesRequest) returns (FindRoutesResponse) {}
  rpc RemoveRoutes (RemoveRoutesRequest) returns (Empty) {}
}
```

**Test Criteria**

A Location Service SHOULD have Unit Testing for all its core functionalities.

**Security Consideration**

None
