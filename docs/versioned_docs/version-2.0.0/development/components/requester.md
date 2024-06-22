# Requester

The Requester service is an optional service used when you want to reach an EdgePort using gRPC instead of SIP. As of the release of this publication, we only use this component when the network needs a Registry Service. However, this may change in the future, so be sure to check in to see if there are any other potential uses.

## Configuration Spec

The Requester service does not have a configuration file. However the following environment variables are available:

- `BIND_ADDR` - Address to bind the service (Defaults to `0.0.0.0:51909`)
- `ENABLE_HEALTHCHECKS` - Enable health checks (Defaults to `true`)

## Communication and Protobuf Spec

Services communicate with the Requester service using gRPC. The Requester, in turn, communicates with the EdgePort using SIP. The contract for communication with the Requester service is defined in the following protobuf:

```protobuf
syntax = "proto3";

package fonoster.routr.requester.v2beta1;

import "common.proto";
import "sipmessage.proto";
import "processor.proto";

// Requester service
service Requester {
  // Send Message Request
  rpc SendMessage (SendMessageRequest) returns (SendMessageResponse) {}
}

message SendMessageRequest {
  string target = 1;
  fonoster.routr.processor.v2beta1.Method method = 2;
  fonoster.routr.common.v2beta1.Transport transport = 3;
  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 4;
}

message SendMessageResponse {
  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 1;
}
```

Link to the [protobuf definition.](https://github.com/fonoster/routr/blob/main/mods/common/src/protos/requester.proto)

## Launching the Requester with Docker

The Requester is available as a Docker image from [Docker Hub](https://hub.docker.com/r/fonoster/routr-requester). To launch the Requester with Docker, you can use the following command:

```bash
docker run -it -p 51909:51909 fonoster/routr-requester
```

The previous example will pull the latest version of the Requester from Docker Hub and launch it with the default configuration. The Requester will listen to port `51909` for gRPC requests. Remember, your Docker container must expose the ports in your configuration file. By default, the Requester listens on port `51909`.

## Quick Test with gRPCurl

One easy way to interact with the Requester for testing and development is to use [gRPCurl](https://github.com/fullstorydev/grpcurl). The following example shows how to send a request to the Requester using gRPCurl:

```bash
grpcurl -plaintext \
  -import-path /path/to/protos \
  -proto requester.proto  -d '{...}' \
  localhost:51909 \
  fonoster.routr.requester.v2beta1.Requester/SendMessage
```
