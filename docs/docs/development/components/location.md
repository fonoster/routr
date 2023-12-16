# Location Service

In Routr, the Location Service serves two primary purposes. The first purpose is to locate the route to an endpoint in the location table. The second is to load balance requests.

Routr's load balancing is done at the Location Service level and occurs in the context of Peers. To better explain this, let's take a closer look at some applications where this is useful.

For example, you can create a Peer configuration and share the same credentials if you have multiple Asterisk servers. By doing this, Routr will send a request to the instance of Asterisk according to the load-balancing algorithm you have selected.

Two balancing algorithms are available. The first is `round-robin`, and the second is `least-sessions`.

Now, let's consider a situation where you want to deploy the server and send all PSTN traffic to a conference room in Asterisk. For such a scenario, you must configure a Peer to represent your feature server and a Number to route calls from the PSTN.

To do this, create a Peer configuration for your Asterisk server similar to the following:

```yaml
apiVersion: v2beta1
kind: Peer
ref: peer-01
metadata:
  name: Asterisk (Media Server)
spec:
  aor: backend:conference
  username: asterisk
  credentialsRef: credentials-01
  loadBalancing:
    withSessionAffinity: true
    algorithm: least-sessions
```

Notice that the load balancing section sets the `withSessionAffinity` to `true`. We need session affinity to ensure that all calls related to the conference arrive on the same Asterisk server. 

Every Asterisk server that registers using the `asterisk` username will join the same group under the `backend:conference` Address of Record (AOR).

## Configuration Spec

To configure the Location Service, you must provide a YAML or JSON configuration with the following structure.

| Property           | Description                                         | Required |
|--------------------|-----------------------------------------------------|----------|
| `region`           | Reserved for future use                             | No       |
| `bindAddr`         | IPv4 interface on which to accept requests          | No       |
| `cache`            | Cache configuration                                 | No       |
| `cache.provider`   | Cache provider (Accepts either `memory` or `redis`) | No       |
| `cache.parameters` | Cache parameters (Comma-separated key-value pairs)  | No       |

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

Filename: `location.yaml` or `location.json`

```yaml
kind: Location
apiVersion: v2beta1
metadata:
  region: default
spec:
  bindAddr: 0.0.0.0:51902
  cache:
    provider: redis
    parameters: "host=localhost,port=6379"
```

Notice that using the `memory` provider will only work for simple cases where you run a single instance of the Location Service. Suppose you need the `least-session` algorithm and run multiple instances of the Location Service. In such cases, you will need the `redis` provider.

## Communication and Protobuf Spec

Upstream service can communicate with the Location Service using gRPC. The following protobuf contains the definition of the Location Service API.

```protobuf
syntax = "proto3";

package fonoster.routr.location.v2beta1;

import "google/protobuf/empty.proto";
import "common.proto";
import "processor.proto";

service Location {
  rpc AddRoute (AddRouteRequest) returns (.google.protobuf.Empty) {}
  rpc FindRoutes (FindRoutesRequest) returns (FindRoutesResponse) {}
  rpc RemoveRoutes (RemoveRoutesRequest) returns (.google.protobuf.Empty) {}
}

// A binding created by an endpoint (Softphone, PBX, Conference System, etc.)
message Route {
  string user = 1;
  string host = 2;
  string port = 3;
  string advertised_host = 13;
  string advertised_port = 14;
  fonoster.routr.common.v2beta1.Transport transport = 4;
  int64 registered_on = 5;
  int32 expires = 6;
  int32 session_count = 7;
  string edge_port_ref = 8;
  repeated fonoster.routr.processor.v2beta1.NetInterface listening_points = 9;
  repeated string localnets = 10;
  repeated string external_addrs = 11;
  // During route creation, an endpoint can request to add labels that can later be
  // used as selectors. For example, a Softphone can add a label `priority=1` to indicate
  // that it is the preferred endpoint for the given AOR.
  map<string, string> labels = 12;
}

message AddRouteRequest {
  // Address of record for the endpoint or trunk
  string aor = 1;
  Route route = 2;
}

message FindRoutesRequest {
  message Backend {
    enum Algoritm {
      ROUND_ROBIN = 0;
      LEAST_SESSIONS = 1;
    }
    string ref = 1;
    bool with_session_affinity = 2;
    Algoritm algorithm = 3;
  }
  string call_id = 1;
  string aor = 2;
  string session_affinity_ref = 3;
  Backend backend = 4;
  map<string, string> labels = 5;
}

message FindRoutesResponse {
  repeated Route routes = 1;
}

message RemoveRoutesRequest {
  string aor = 1;
}
```

Upon receiving a valid `AddRoute` request, the Location Service will add the route to the location table. The structure of the new Route resembles that of the Route message in the protobuf definition.

Link to the [protobuf definition.](https://github.com/fonoster/routr/blob/main/mods/common/src/protos/location.proto)

## Launching the Location Service with Docker

The Location Service is available as a Docker image from [Docker Hub](https://hub.docker.com/r/fonoster/routr-location). To launch the Location Service with Docker, you can use the following command:

```bash
docker run -it -v $(pwd)/location.yaml:/etc/routr/location.yaml -p 51902:51902 fonoster/routr-location
```

The previous example will pull the latest version of the Location Service from Docker Hub and launch it with the default configuration. The Location Service will listen to port `51902` for gRPC requests. Remember, your Docker container must expose the ports in your configuration file. By default, the Dispatcher listens on port `51902`.

## Quick Test with gRPCurl

One easy way to interact with the Location Service for testing and development is to use [gRPCurl](https://github.com/fullstorydev/grpcurl). The following example shows how to send a request to the Location Service using gRPCurl:

```bash
grpcurl -plaintext \
  -import-path /path/to/protos \
  -proto location.proto  -d '{...}' \
  localhost:51901 \
  fonoster.routr.location.v2beta1.Location/AddRouteRequest
```
