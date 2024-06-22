# Registry Service

The Registry component sends outbound registration to trunking services. The service will activate for Trunks with the `spec.sendRegister` field set to true. The Registry service relies on the Requester service to send requests to the EdgePort.

## Configuration Spec

To configure the Registry Service, you must provide a YAML or JSON configuration with the following structure.

| Property             | Description                                                  | Required |
|----------------------|--------------------------------------------------------------|----------|
| `requesterAddr`      | Address of service to send requests                          | Yes      |
| `apiAddr`            | Address of API service                                       | Yes      |
| `registerInterval`   | Interval for sending registration requests (Defaults to `60s`)| No      |
| `cache`              | Cache configuration                                          | No       |
| `cache.provider`     | Accepts either `memory` or `redis`                           | No       |
| `cache.parameters`   | Comma-separated key-value pairs                              | No       |
| `methods`            | Acceptable SIP Methods (reserved for future use)             | No       |
| `edgePorts`          | List of EdgePorts for outbound registrations                 | Yes      |
| `edgePorts.address`  | Address of EdgePort                                          | Yes      |
| `edgePorts.region`   | Region of EdgePort (reserved for future use)                 | No       |

The `cache.parameters` property is only needed if you are using the Redis provider. 

The following table shows the available parameters for the Redis provider.

| Property   | Description                         | Required |
|------------|-------------------------------------|----------|
| `username` | Username (if required by Redis)     | No       |
| `password` | Password (if required by Redis)     | No       |
| `host`     | Redis host (Defaults to `localhost`)| No       |
| `port`     | Redis port (Defaults to `6379`)     | No       |
| `secure`   | Use secure connection for Redis     | No       |

Here is an example of a configuration file:

Filename: `registry.yaml` or `registry.json`

```yaml
kind: Registry
apiVersion: v2beta1
spec:
  requesterAddr: requester:51909
  apiAddr: apiserver:51907
  cache:
    provider: memory
  methods:
    - INVITE
    - MESSAGE
  edgePorts:
    - address: sip01.edgeport.net:5060
      region: us-east1
    - address: sip02.edgeport.net:6060
```

## Communication and Protobuf Spec

The registry communicates with the Requester service using gRPC. The Requester, in turn, communicates with the EdgePort using SIP. The contract for communication with the Requester service is defined in the following protobuf:

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

## Launching the Registry Service with Docker

The Registry Service is available as a Docker image from [Docker Hub](https://hub.docker.com/r/fonoster/routr-registry). To launch the Registry Service with Docker, you can use the following command:

```bash
docker run -it -v $(pwd)/registry.yaml:/etc/routr/registry.yaml fonoster/routr-registry
```

The previous example will pull the latest version of the Location Service from Docker Hub and launch it with the default configuration. The Registry Service will connect to the Requester service using the address `requester:51909` and the API service using the address `apiserver:51907`.
