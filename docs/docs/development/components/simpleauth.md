# SimpleAuth Service

The SimpleAuth component is an optional middleware service to authenticate SIP requests in Routr. The SimpleAuth is ideal for testing and small deployments.

## Configuration Spec

The SimpleAuth provides the following environment variables for configuration:

- `BIND_ADDR` - The address where the service will listen for gRPC requests. Default: `0.0.0.0:51903`
- `ALLOWLIST` - A comma-separated list of Users allowed to bypass authentication
- `METHODS` - A comma-separated list of SIP methods that require authentication (e.g., `INVITE, REGISTER, MESSAGE`). Required.
- `PATH_TO_AUTH` - The path to a file containing the credentials for the users

Example of the authentication file:

Filename `auth.json`

```json
[
  { 
    "username": "1001", 
    "secret": "1234" 
  },
  { 
    "username": "john",
    "secret": "1234" 
  }
]
```

## Communication and Protobuf Spec

The Message Dispatcher communicates SimpleAuth service using gRPC. The SimpleAuth, in turn, authenticates SIP requests and forwards them if the request is valid. 

The following is the protobuf definition for the SimpleAuth service:

```protobuf

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
  // Communicates information about the capabilities of calling and receiving SIP phones
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

## Launching the SimpleAuth with Docker

The SimpleAuth is available as a Docker image from [Docker Hub](https://hub.docker.com/r/fonoster/routr-simpleauth). To launch the SimpleAuth with Docker, you can use the following command:

```bash
docker run -it \
  -p 51903:51903 \
  -e ALLOWLIST=anonymous,1001 \
  -e METHODS=INVITE,REGISTER,MESSAGE \
  -e PATH_TO_AUTH=/path/to/auth.json \
  -v /path/to/auth.json:/path/to/auth.json \
  fonoster/routr-simpleauth
```

The previous example will pull the latest version of the SimpleAuth from Docker Hub and launch the service. The service will listen on the default port, `51903`, for gRPC requests. Remember, your Docker container must expose the service's ports, too.

## Quick Test with gRPCurl

One easy way to interact with SimpleAuth for testing and development is to use [gRPCurl](https://github.com/fullstorydev/grpcurl). The following example shows how to send a SIP Message to the SimpleAuth.

```bash
grpcurl -plaintext \
  -import-path /path/to/protos \
  -proto processor.proto  -d '{...}' \
  localhost:51901 \
  fonoster.routr.processor.v2beta1.Processor/ProcessMessage
```