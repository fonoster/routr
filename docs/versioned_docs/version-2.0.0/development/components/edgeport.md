# EdgePort

The EdgePort component accepts SIP Messages, parses them into protobuf, and sends them to the Message Dispatcher. After a SIP Message is processed, the EdgePort will forward the SIP Message to the next hop.

The following diagram shows the relation between a SIP client, the EdgePort, and the Dispatcher. 

```text
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

While we show the Dispatcher, we could also use a Processor. Both components share the same protobuf. However, the Dispatcher is required when you expect multiple Processors or at least one Middleware.

For example, if your use case requires having one Processor for SIP INVITE and another for SIP MESSAGE requests, you will need to use a Dispatcher. Similarly, if you want to use a Middleware, you will need to use a Dispatcher.

If you only have one Processor and have not Middleware, you can use the Processor directly. Running the Processor directly will make your deployment simpler and faster.

<!-- TODO: We should add more information how we automatically convert available ceritifcates to pkcs12 -->

## Configuration Spec

To configure the EdgePort, you must provide a YAML or JSON configuration with the following structure.

| Property                                   | Description                                                                 | Required |
|--------------------------------------------|-----------------------------------------------------------------------------|----------|
| `ref`                                      | Reference to the EdgePort                                                   | Yes      |
| `metadata.region`                          | Region where the EdgePort is located (reserved for future use)              | No       |
| `spec.unknownMethodAction`                 | What to do if an incoming request type is not allowed (reserved for future use) | No   |
| `spec.transport`                           | Enabled Transport Protocols                                                 | Yes      |
| `spec.transport[*].protocol`               | Transport protocol                                                          | Yes      |
| `spec.transport[*].bindAddr`               | Ipv4 interface to accept requests on                                        | No       |
| `spec.transport[*].port`                   | Port to listen on                                                           | Yes      |
| `spec.methods`                             | Acceptable SIP Methods                                                      | Yes      |
| `spec.processor`                           | Adjacent service for message routing                                        | Yes      |
| `spec.processor.addr`                      | Address of the adjacent service                                             | Yes      |
| `spec.localnets`                           | Networks considered to be in the same local network                         | No       |
| `spec.externalAddrs`                       | EdgePort external ip addresses                                              | No       |
| `spec.bindAddr`                            | Ipv4 interface to accept requests on                                        | No       |
| `spec.securityContext`                     | Security context                                                            | No       |
| `spec.securityContext.client`              | Client security context                                                     | No       |
| `spec.securityContext.client.protocols`    | TLS protocols used by the client (e.g., SSLv3, TLSv1.2)                     | No       |
| `spec.securityContext.client.authType`     | Client authentication type (e.g., Disabled, DisabledAll, Required, Wanted)  | No       |
| `spec.securityContext.keyStore`            | Path to the key store file                                                  | No       |
| `spec.securityContext.trustStore`          | Path to the trust store file                                                | No       |
| `spec.securityContext.keyStorePassword`    | Password for the key store                                                  | No       |
| `spec.securityContext.trustStorePassword`  | Password for the trust store                                                | No       |
| `spec.securityContext.keyStoreType`        | Type of the key store (e.g., pkcs12)                                        | No       |

The security context is required if the EdgePort is configured to use a secure protocol such as `TLS` or `WSS`. 

> Please see JAINSIP docs for details on the security context [properties.](https://javadoc.io/doc/javax.sip/jain-sip-ri/1.2.220/gov/nist/javax/sip/SipStackImpl.html) 

Here is an example of a configuration file:

Filename: `dispatcher.yaml` or `dispatcher.json`

```yaml
kind: EdgePort
apiVersion: v2beta1
ref: edgeport-01
metadata:
  region: default
spec:
  unknownMethodAction: Discard
  processor:
    addr: dispatcher:51901  
  securityContext:
    client:
      protocols:
        - SSLv3
        - TLSv1.2
      authType: DisabledAll
    keyStorePassword: changeme
    trustStorePassword: changeme
    keyStore: "/etc/routr/certs/signaling.p12"
    trustStore: "/etc/routr/certs/signaling.p12"
    keyStoreType: pkcs12
  externalAddrs:
    - 10.111.220.2
    - sip01.edgeport.net
  localnets:
    - 127.0.0.1/8
    - 10.111.221.2/24
  methods:
    - REGISTER
    - MESSAGE
    - INVITE
    - ACK
    - BYE
    - CANCEL
  transport:
    - protocol: tcp
      port: 5060
    - protocol: udp
      port: 5060
    - protocol: tls
      port: 5061
    - protocol: ws 
      port: 5062
    - protocol: wss
      port: 5063
```

The EdgePort requires the `spec.externalAddrs` field to function properly in NATed environments like Docker. When provided, the `spec.externalAddrs` is added as metadata to the SIP message and can later be used by a Processor to determine the correct advertised address.

**Environment Variables**

The EdgePort provides the following environment variables as a convenient way to overwrite some configuration properties or provide additional behavior not covered by the configuration spec.

- `PROCESSOR_ADDR` - Overwrites the `spec.processor.addr` property
- `HOSTNAME` - Overwrites the `ref` property. If running in K8s, `ref` will be set to the pod's hostname.
- `IGNORE_LOOPBACK_FROM_LOCALNETS` - If set to `true`, the EdgePort will ignore the loopback address from the `localnets` property. In Docker deployments, this is set to `true` by default.
- `CONSOLE_PUBLISHER_ENABLED` - If set to `true`, the EdgePort will publish SIP messages to the console publisher. Useful for debugging purposes. 
- `NATS_PUBLISHER_ENABLED` - If set to `true`, the EdgePort will publish SIP messages to the NATS publisher.
- `NATS_PUBLISHER_SUBJECT` - Overwrites the default subject the NATS publisher uses. The default subject is `routr`.
- `NATS_PUBLISHER_URL` - This is required if `NATS_PUBLISHER_ENABLED` is set to `true`. It should contain the NATS server URL. For example: `nats://nats:4222`.

## Communication and Protobuf Spec

While the entry point to the EdgePort is SIP, the communication with downstream services happens via gRPC. The EdgePort uses the following protobuf messages to communicate with the Dispatcher or Processor, which shares the protobuf definition.

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

Link to the [protobuf definition.](https://github.com/fonoster/routr/blob/main/mods/common/src/protos/processor.proto)

## Launching the EdgePort with Docker

The EdgePort is available as a Docker image from [Docker Hub](https://hub.docker.com/r/fonoster/routr-edgeport). To launch the EdgePort with Docker, you can use the following command:

```bash
docker run -it -v $(pwd)/edgeport.yaml:/etc/routr/edgeport.yaml -p 5060:5060/udp fonoster/routr-edgeport
```

The previous example will pull the latest version of the EdgePort from Docker Hub and launch it with the default configuration. The EdgePort will be listening on port `5060` for UDP traffic. Remember, your Docker container must expose the ports in your configuration file. For example, if you want the port `5061` for TLS traffic, you must add the following flag to the `docker run` command: `-p 5061:5061`.
