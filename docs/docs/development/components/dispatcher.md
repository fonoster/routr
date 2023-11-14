# Message Dispatcher

The Message Dispatcher, or Dispatcher for short, is a component responsible for receiving messages from the EdgePort and routing them to the appropriate Processor and Middleware.

The Dispatcher is required when your deployment has more than one Processor or has at least one Middleware. If your deployment has only one Processor and no Middleware, you can skip the Dispatcher and connect the EdgePort directly to the Processor.

The following diagram shows the relation between the EdgePort, the Message Dispatcher, and the Message Processor.

```text
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

## Configuration Spec

To configure the Dispatcher, you must provide a YAML or JSON configuration with the following structure.

You can configure the Dispatcher using a YAML or JSON file that has the following structure:

| Property                             | Description                                               | Required |
|--------------------------------------|-----------------------------------------------------------|----------|
| `ref`                                | Reference to the Dispatcher                               | Yes      |
| `spec.bindAddr`                      | Ipv4 interface to accept requests on                      | No       |
| `spec.processors`                    | List of Processors                                        | Yes      |
| `spec.processors[*].ref`             | Reference to the Processor                                | Yes      |
| `spec.processors[*].matchFunc`       | Matching function                                         | Yes      |
| `spec.processors[*].addr`            | Address of the Processor                                  | Yes      |
| `spec.processors[*].methods`         | List of SIP Methods supported by the Processor            | Yes      |
| `spec.middlewares`                   | List of Middlewares                                       | No       |
| `spec.middlewares[*].ref`            | Reference to the Middleware                               | Yes      |
| `spec.middlewares[*].addr`           | Address of the Middleware                                 | Yes      |
| `spec.middlewares[*].postProcessor`  | Whether to process the SIP Message after the Processor    | Yes      |

Here is an example of a configuration file:

Filename: `dispatcher.yaml` or `dispatcher.json`

```yaml
kind: MessageDispatcher
apiVersion: v2beta1
ref: message-dispatcher
spec:
  bindAddr: 0.0.0.0:51901
  processors:
    - ref: connect-processor
      addr: connect:51904
      matchFunc: req => true
      methods:
        - REGISTER
        - MESSAGE
        - INVITE
        - ACK
        - BYE
        - CANCEL
```

The matching function is a Javascript function that takes the SIP Message and returns a boolean value. The Dispatcher will forward the message to the first Processor that matches the criteria. Therefore, the order of the Processors and the matching function is essential to ensure the correct routing. 

The `matchFunc` is a javascript function that leverages the JSON representation of the [SIPMessage](https://github.com/fonoster/routr/blob/main/mods/common/src/protos/sipmessage.proto) protobuf. 

This example features a Dispatcher that matches MESSAGE requests to the IM Processor and all others to the Connect Processor.

```yaml
kind: MessageDispatcher
apiVersion: v2beta1
ref: message-dispatcher
spec:
  bindAddr: 0.0.0.0:51901
  processors:
    - ref: im-processor
      addr: im:51904
      matchFunc: req => req.method === "MESSAGE"
      methods:
        - MESSAGE
    - ref: connect-processor
      addr: connect:51904
      matchFunc: req => true
      methods: 
        - REGISTER
        - INVITE
        - ACK 
        - BYE
        - CANCEL
```

The following examples show typical matching functions:

Match all SIP Messages.

```javascript
req => true
```

Match SIP Messages with a specific method.

```javascript
req => req.method === "MESSAGE"
```

Match SIP Messages with a specific method and a specific header.

```javascript
req => req.method === "MESSAGE" && req.message.from.address.uri.user === "alice"
```

Match SIP Messages with a specific `User-Agent` header.

```javascript
req => req.message.extensions.find(e => e.name === "User-Agent" && e.value.includes("Zoiper"))
```

## Communication and Protobuf Spec

The Message Dispatcher uses gRPC to communicate with the Processors and Middlewares, which happen to share the protobuf definition:

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
  // Sends mid-session information
  INFO = 12;
  // Asks the recipient to issue a call transfer
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

Link to the [protobuf definition.](https://github.com/fonoster/routr/blob/main/mods/common/src/protos/processor.proto)

## Launching the Dispatcher with Docker

The Message Dispatcher is available as a Docker image from [Docker Hub](https://hub.docker.com/r/fonoster/routr-dispatcher). To launch the Dispatcher with Docker, you can use the following command:

```bash
docker run -it -v $(pwd)/dispatcher.yaml:/etc/routr/dispatcher.yaml -p 51901:51901 fonoster/routr-dispatcher
```

The previous example will pull the latest version of the Dispatcher from Docker Hub and launch it with the default configuration. The Dispatcher will be listening on port `51901` for gRPC requests. Remember, your Docker container must expose the ports in your configuration file. By default, the Dispatcher listens on port `51901`.

## Quick Test with gRPCurl

One easy way to interact with the Dispatcher for testing and development is to use [gRPCurl](https://github.com/fullstorydev/grpcurl). The following example shows how to send a SIP Message to the Dispatcher.

```bash
grpcurl -plaintext \
  -import-path /path/to/protos \
  -proto processor.proto  -d '{...}' \
  localhost:51901 \
  fonoster.routr.processor.v2beta1.Processor/ProcessMessage
```