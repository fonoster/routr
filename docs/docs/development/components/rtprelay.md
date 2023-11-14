# RTPRelay

The RTPRelay is an optional middleware service that can control RTPEngine instances. The RTPRelay component enables interoperability between WebRTC-based clients, such as SIP.js, and legacy SIP clients. Another use case for the RTPRelay is to help SIP clients who cannot send and receive media directly.

## Configuration Spec

Unlike other components, the RTPRelay service does not have a configuration file. However, the following environment is to configure the service:

- `BIND_ADDR` - The IP address and port to bind the gRPC server. Defaults to `0.0.0.0:51903`
- `RTPENGINE_HOST` - The IP address or hostname of the RTPEngine service. Required.
- `RTPENGINE_PORT` - The port of the RTPEngine service. Defaults to `22222`.
- `RTPENGINE_TIMEOUT` - The timeout in milliseconds for the RTPEngine service. Defaults to `5000`.

## Communication and Protobuf Spec

Services communicate with RTPRelay service using gRPC. The RTPRelay, in turn, communicates with RTPEngine using the "ng protocol." The contract for communication with RTPRelay service consists of the following protobuf:

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

## Launching the RTPRelay with Docker

The RTPRelay is available as a Docker image from [Docker Hub](https://hub.docker.com/r/fonoster/routr-rtprelay). To launch the RTPRelay with Docker, you can use the following command:

```bash
docker run -it -e RTPENGINE_HOST="rtpengine" -p 51903:51903 fonoster/routr-rtprelay
```

The previous example will pull the latest version of the RTPRelay from Docker Hub and launch the service. The service will listen on the default port, `51903`, for gRPC requests. Remember, your Docker container must expose the service's ports, too.

## Quick Test with gRPCurl

One easy way to interact with the RTPRelay for testing and development is to use [gRPCurl](https://github.com/fullstorydev/grpcurl). The following example shows how to send a SIP Message to the RTPRelay.

```bash
grpcurl -plaintext \
  -import-path /path/to/protos \
  -proto processor.proto  -d '{...}' \
  localhost:51901 \
  fonoster.routr.processor.v2beta1.Processor/ProcessMessage
```