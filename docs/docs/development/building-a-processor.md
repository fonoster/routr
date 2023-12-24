# Building a Processor

Processors are how we extend the signaling functionality of Routr. Processors are where we can add new SIP headers, modify existing ones, add endpoints to the Location Service, etc. Processors are implemented as gRPC services and use the [Alterations API](/docs/overview/concepts#alterations) to modify SIP messages. A Processor is the last stop for a SIP message before it is sent out to the network.

Here is a non-exhaustive list of things you can do with a Processor:

- Build an instant messaging application
- Create a custom logic for a SCAIP system
- Build a SIP Recorder when combined with RTPEngine
- Doorbell Camera System integration
- Custom logic for a SIP IoT system

## Processor Contract

A Processor is a gRPC service that implements the `Processor` interface. The interface is defined in the [processor.proto](https://github.com/fonoster/routr/blob/main/mods/common/src/protos/processor.proto) file. 

Here is the definition of the Processor interface:

```protobuf
syntax = "proto3";

package fonoster.routr.processor.v2beta1;

import "common.proto";
import "sipmessage.proto";

// Processor service
service Processor {
  // Process Message Request
  rpc ProcessMessage (MessageRequest) returns (MessageResponse) {}
}

enum Method {
  UNKNOWN = 0;
  // Communicates user location (hostname, IP)
  REGISTER = 1;
  // Establishes a session
  INVITE = 2;
  // Transports Instant Messages
  MESSAGE = 3;
  // Publishes an event to the Server
  PUBLISH = 4;
  // Notifies the subscriber of a new event
  NOTIFY = 5;
  // Subscribes for Notification from the notifier
  SUBSCRIBE = 6;
  // Confirms an INVITE request
  ACK = 7;
  // Terminates a session
  BYE = 8;
  // Cancels establishing of a session
  CANCEL = 9;
  // Communicates information about the capabilities of the calling and receiving SIP phones
  OPTIONS = 10;
  // Provisional Acknowledgement
  PRACK = 11;
  // Sends mid session information
  INFO = 12;
  // Asks the recipient to issue call transfer
  REFER = 13;
  // Modifies the state of a session
  UPDATE = 14;
}

message NetInterface {
  string host = 1;
  int32 port = 2;
  fonoster.routr.common.v2beta1.Transport transport = 3;
}

message MessageRequest {
  // Same as the Call-Id header 
  string ref = 1;
  string edge_port_ref = 2;
  Method method = 3;
  NetInterface sender = 4;
  repeated NetInterface listening_points = 5;
  repeated string external_addrs = 6;
  repeated string localnets = 7;
  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 8;
  map<string, string> metadata = 9;
}

message MessageResponse {
  NetInterface sender = 1;
  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 2;
  map<string, string> metadata = 3;
}
```

As you can see in the protobuf, the message contains the SIP message and metadata about the message. It includes things like the sender, the method, the listening points, etc. This metadata is necessary because it is how Routr processes messages statelessly.

You can write processors in any language that supports gRPC. However, at the moment, we provide better support for NodeJS.

One feature of using NodeJS is receiving the JSON representation of the gRPC message. That makes it easier to work with the message in JavaScript.

As an example, here is the JSON representation of a SIP REGISTER message:

```json
{
  "ref": "AynhXaFtbdXwHrUEzt_rUQ..",
  "edgePortRef": "edgeport-01",
  "method": "REGISTER",
  "externalAddrs": ["200.22.21.42"],
  "localnets": ["127.0.0.1/8", "10.100.42.127/24", "10.100.43.128/31"],
  "listeningPoints": [
    {
      "host": "0.0.0.0",
      "port": 5060,
      "transport": "TCP"
    },
    {
      "host": "0.0.0.0",
      "port": 5060,
      "transport": "UDP"
    }
  ],
  "sender": {
    "host": "127.0.0.1",
    "port": 36214,
    "transport": "TCP"
  },
  "message": {
    "via": [
      {
        "host": "proxy",
        "port": 5060,
        "branch": "z9hG4bK-524287-1---7315a24d84546819",
        "transport": "TCP"
      },
      {
        "host": "127.0.0.1",
        "port": 36214,
        "branch": "z9hG4bK-524287-1---7315a24d84546819",
        "transport": "TCP"
      }
    ],
    "extensions": [
      {
        "name": "CSeq",
        "value": "14 REGISTER"
      },
      {
        "name": "Allow",
        "value": "INVITE"
      },
      {
        "name": "User-Agent",
        "value": "Z 5.4.12 v2.10.13.2"
      },
      {
        "name": "Allow-Events",
        "value": "presence"
      }
    ],
    "from": {
      "address": {
        "uri": {
          "user": "1001",
          "userPassword": "",
          "host": "sip.local",
          "transportParam": "UDP",
          "mAddrParam": "",
          "methodParam": "",
          "userParam": "",
          "ttlParam": -1,
          "port": 5060,
          "lrParam": false,
          "secure": false
        },
        "displayName": "John Doe",
        "wildcard": false
      },
      "tag": "9041462a"
    },
    "to": {
      "address": {
        "uri": {
          "user": "1001",
          "userPassword": "",
          "host": "sip.local",
          "transportParam": "TCP",
          "mAddrParam": "",
          "methodParam": "",
          "userParam": "",
          "ttlParam": -1,
          "port": 5060,
          "lrParam": false,
          "secure": false
        },
        "displayName": "",
        "wildcard": false
      },
      "tag": ""
    },
    "contact": {
      "address": {
        "uri": {
          "user": "1001",
          "userPassword": "",
          "host": "127.0.0.1",
          "transportParam": "TCP",
          "mAddrParam": "",
          "methodParam": "",
          "userParam": "",
          "ttlParam": -1,
          "port": 36214,
          "lrParam": false,
          "secure": false
        },
        "displayName": "",
        "wildcard": false
      },
      "expires": -1,
      "qValue": -1
    },
    "callId": {
      "callId": "AynhXaFtbdXwHrUEzt_rUQ.."
    },
    "contentLength": {
      "contentLength": 0
    },
    "maxForwards": {
      "maxForwards": 70
    },
    "expires": {
      "expires": 60
    },
    "recordRoute": [
      {
        "parameters": {
          "a": "1",
          "b": "2"
        },
        "address": {
          "uri": {
            "user": "",
            "userPassword": "",
            "host": "sip.local",
            "transportParam": "TCP",
            "mAddrParam": "",
            "methodParam": "",
            "userParam": "",
            "ttlParam": -1,
            "port": 5060,
            "lrParam": false,
            "secure": false
          },
          "displayName": "",
          "wildcard": false
        }
      }
    ],
    "route": [
      {
        "parameters": null,
        "address": {
          "uri": {
            "user": "",
            "userPassword": "",
            "host": "10.100.42.127",
            "transportParam": "TCP",
            "mAddrParam": "",
            "methodParam": "",
            "userParam": "",
            "ttlParam": -1,
            "port": 5060,
            "lrParam": false,
            "secure": false
          },
          "displayName": "",
          "wildcard": false
        }
      },
      {
        "parameters": null,
        "address": {
          "uri": {
            "user": "",
            "userPassword": "",
            "host": "10.100.42.128",
            "transportParam": "TCP",
            "mAddrParam": "",
            "methodParam": "",
            "userParam": "",
            "ttlParam": -1,
            "port": 5060,
            "lrParam": false,
            "secure": false
          },
          "displayName": "",
          "wildcard": false
        }
      }
    ],
    "authorization": {
      "realm": "sip.local",
      "scheme": "Digest",
      "cNonce": "acbcc60094edde23f49b01e18bafd34e",
      "nonce": "b8fe2321cf489ac475c80c6e5cfa1c22",
      "algorithm": "MD5",
      "qop": "",
      "opaque": "",
      "response": "227fe247ff0b9fa4fcf2706b587bf995",
      "username": "1001",
      "uri": "sip:sip.local;transport=TCP",
      "nonceCount": 13
    },
    "requestUri": {
      "user": "",
      "userPassword": "",
      "host": "sip.local",
      "transportParam": "TCP",
      "mAddrParam": "",
      "methodParam": "",
      "userParam": "",
      "ttlParam": -1,
      "port": 5060,
      "lrParam": false,
      "secure": false
    },
    "messageType": "REQUEST"
  }
}
```

## Building a Processor from a Template

To make it easier to build processors, we provide a template you can use to get started. The template is available in the [routr-processor-template.](https://github.com/fonoster/nodejs-processor)

To use the template, you must have [NodeJS](https://nodejs.org/en/) installed in your system. Once you have NodeJS installed, you can use the following command to create a new processor:

```bash
npx degit fonoster/nodejs-processor my-processor
```

The previous command will create a new folder called `my-processor` with the following structure:

```bash
.
├── CONTRIBUTING.md
├── Dockerfile
├── LICENSE
├── README.md
├── commitlint.config.js
├── compose.yaml
├── package-lock.json
├── package.json
├── src
│   ├── envs.ts
│   ├── handlers.ts
│   └── index.ts
├── test
│   └── unit.test.ts
└── tsconfig.json
```

The most important file is the `handlers.ts` file. This file is where you will write your processor logic. Feel free to review the file, as it contains an example of how to write an instant messaging processor.

From there, you can install the dependencies and start the processor:

```bash
cd my-processor
npm install
npm start
```

You may now start sending SIP messages to your processor from EdgePort or Dispatcher.