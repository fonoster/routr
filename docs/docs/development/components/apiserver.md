# APIServer

The APIServer is an optional component that can be used to describe a VoIP network in terms of Domains, Agents, Trunks, Numbers, and Peers. The data is stored in a PostgreSQL database and is accessed by other components via gRPC.

The APIServer has two implementations: the `pgdata` for persistent data storage in a PostgreSQL database and the `simpledata` for storing data in files. The `simpledata` implementation is intended for testing and small deployments.

The `pgdata` has several advantages over the `simpledata` implementation. The first advantage is that the `pgdata` allows you to manage the data using the CTL and SDK. Additionally, all the data entities support the `extended` attribute, enabling you to store additional data in the database in JSON format—more on this in later sections.

**Data Migration**

The `pgdata` implementation uses [Prisma](https://www.prisma.io/) to manage the database schema. Prisma is important because it allows us to migrate the database schema to newer versions of Routr easily.

## Configuration Spec

**pgdata**

The `pgdata` has the following environment variables available for configuration:

- `DATABASE_URL` - The URL of the PostgreSQL database. Example: `postgresql://postgres:postgres@localhost:5432/routr`
- `BIND_ADDR` - The address where the APIServer will listen for gRPC requests. Default to `0.0.0.0:51907`
- `EXTERNAL_SERVER_BIND_ADDR` - The address where the APIServer will listen for HTTP requests. Default to `0.0.0.0:51908`
- `TLS_ON` - Enables TLS for the gRPC server. Default to `false`
- `VERIFY_CLIENT_CERT` - Enables client certificate verification. Default to `false`
- `CACERT` - The path to the CA certificate. Default to `/etc/routr/certs/ca.crt`
- `SERVER_CERT` - The path to the server certificate. Default to `/etc/routr/certs/server.crt`
- `ENFORCE_E164` - Enables E164 validation for Numbers. Default to `false`
- `ENFORCE_E164_WITH_MOBILE_PREFIX` - Enables E164 validation for Numbers with mobile prefixes. Default to `false`

For details about connecting to the `pgdata` to manage the data, see the [CTL](../ctl/README.md) and [SDK](../sdk/README.md) documentation.

**simpledata**

The `simpledata` has the following environment variables available for configuration:

- `PATH_TO_RESOURCES` - The path to the directory where the data will be stored. Example: `/etc/routr/resources`
- `BIND_ADDR` - The address where the APIServer will listen for gRPC requests. Default to `0.0.0.0:51907`

Both implementations provide Routr with the same protobuf interface, so you can switch between them without changing the other components. 

In your resources directory, you will find the following files:

- `agents.yaml` - A list of Agents
- `domains.yaml` - A list of Domains to which Agents belong
- `trunks.yaml` - Represents the list of Trunks
- `numbers.yaml` - A list of Numbers to which Trunks belong
- `peers.yaml` - A list of Peers that cooperate with Routr (e.g., Asterisk, FreeSWITCH, etc.)
- `credentials.yaml` - A list of Credentials for Peers and Agents
- `acl.yaml` - The list of ACLs

> You may also provide a `.json` file instead of a `.yaml` file.

The Agents configuration file has the following structure:

| Property                             | Description                                               | Required |
|--------------------------------------|-----------------------------------------------------------|----------|
| `apiVersion`                         | The API version of the Agent                              | Yes      |
| `kind`                               | The kind of resource                                      | Yes      |
| `ref`                                | Reference to the Agent                                    | Yes      |
| `metadata.name`                      | A friendly name for the Agent                             | Yes      |
| `spec.username`                      | The username of the Agent                                 | Yes      |
| `spec.domainRef`                     | Reference to the Domain of the Agent                      | Yes      |
| `spec.credentialsRef`                | Reference to the Credentials of the Agent                 | Yes      |
| `spec.privacy`                       | The privacy settings of the Agent (`Private` or `None`)   | No       |
| `spec.enabled`                       | The enabled status of the Agent (reserved for future use) | No       |

An example of an Agents configuration file:

Filename: `agents.yaml`

```yaml
- apiVersion: v2beta1
  kind: Agent
  ref: agent-01
  metadata:
    name: John Doe
  spec:
    username: "1001"
    domainRef: domain-01
    credentialsRef: credentials-01
    privacy: Private
```

In the example above, the Agent `agent-01` has the username `1001`, belongs to the Domain `domain-01`, and uses the Credentials `credentials-01`. Both the Domain and the Credentials are required for the Agent to work.

The Domains configuration file has the following structure:

| Property                                  | Description                                | Required |
|-------------------------------------------|--------------------------------------------|----------|
| `apiVersion`                              | The API version of the Domain              | Yes      |
| `kind`                                    | The kind of resource                       | Yes      |
| `ref`                                     | Reference to the Domain                    | Yes      |
| `metadata.name`                           | A friendly name for the Domain             | Yes      |
| `spec.context.domainUri`                  | The domain URI                             | Yes      |
| `spec.context.egressPolicies`             | The list of egress policies                | No       |
| `spec.context.egressPolicies[*].rule`     | The regular expression to match the number | Yes      |
| `spec.context.egressPolicies[*].numberRef`| Reference to the Number                    | Yes      |

An example of a Domains configuration file:

Filename: `domains.yaml`

```yaml
- apiVersion: v2beta1
  kind: Domain
  ref: domain-01
  metadata:
    name: Local Domain
  spec:
    context:
      domainUri: sip.local
      egressPolicies:
        - rule: ".*"
          numberRef: number-01
```

In the example above, the Domain `domain-01` has the Domain URI `sip.local` and the egress policy `.*` that matches all numbers. The egress policy is associated with the Number `number-01`. The Number `number-01` is required for the Domain to work.

Numbers are used to route calls from and to the PSTN. The Numbers configuration file has the following structure:

| Property                                  | Description                                | Required |
|-------------------------------------------|--------------------------------------------|----------|
| `apiVersion`                              | The API version of the Number              | Yes      |
| `kind`                                    | The kind of resource                       | Yes      |
| `ref`                                     | Reference to the Number                    | Yes      |
| `metadata.name`                           | A friendly name for the Number             | Yes      |
| `metadata.geoInfo.city`                   | The city where the Number is located       | No       |
| `metadata.geoInfo.country`                | The country where the Number is located    | No       |
| `metadata.geoInfo.countryISOCode`         | The ISO code of the country                | No       |
| `spec.trunkRef`                           | Reference to the Trunk                     | Yes      |
| `spec.location.telUrl`                    | The tel URL of the Number                  | Yes      |
| `spec.location.aorLink`                   | The Address of Record (AOR) of the Number  | Yes      |
| `spec.location.sessionAffinityHeader`     | The session affinity header of the Number  | No       |
| `spec.location.extraHeaders`              | The extra headers of the Number            | No       |
| `spec.location.extraHeaders[*].name`      | The name of the extra header               | Yes      |

Tthe ' tel: ' scheme is required when setting the `spec.location.telUrl` property. For example, `tel:+17066041487`. Here, `tel:` indicates that the URI is a telephone number. Please remember that it must match the number sent by your VoIP provider.

Another important property is the `spec.location.aorLink`. The important thing is that the AOR must be present in the location table in the Location Service. Otherwise, the call will fail. The AOR can be a SIP URI or a backend URI. Typically, you will use SIP URIs to route calls to Agents and backend URIs to route calls to Peers.

The `spec.location.sessionAffinityHeader` tells the Location Service to use a specific header to identify the session. This property is helpful in combination with "backend" URIs. For example, if you have a conference server and want to ensure that all calls to the same conference room are routed to the same server, you can use the `X-Room-Id` header to identify the session. The Location Service will use the header's value to identify the session.

An example of a Numbers configuration file:

Filename: `numbers.yaml`

```yaml
- apiVersion: v2beta1
  kind: Number
  ref: number-01
  metadata:
    name: "(706)604-1487"
    geoInfo:
      city: Columbus, GA
      country: USA
      countryISOCode: US
  spec:
    trunkRef: trunk-01
    location:
      telUrl: tel:+17066041487
      aorLink: sip:conference@sip.local
      sessionAffinityHeader: X-Room-Id
      extraHeaders:
        - name: X-Room-Id
          value: jsa-shqm-iyo
```

Numbers must be associated with a Trunk to work. 

The Trunks configuration file has the following structure:

| Property                                  | Description                                | Required |
| ----------------------------------------- | ------------------------------------------ | -------- |
| `apiVersion`                              | The API version of the Trunk               | Yes      |
| `kind`                                    | The kind of resource                       | Yes      |
| `ref`                                     | Reference to the Trunk                     | Yes      |
| `metadata.name`                           | A friendly name for the Trunk              | Yes      |
| `metadata.region`                         | Reserved for future use                    | No       |
| `spec.inbound.uri`                        | The inbound URI of the Trunk               | Yes      |
| `spec.inbound.accessControlListRef`       | Reference to the ACL of the Trunk          | No       |
| `spec.outbound.sendRegister`              | Enables outbound registration              | No       |
| `spec.outbound.credentialsRef`            | Reference to the Credentials of the Trunk  | No       |
| `spec.outbound.uris`                      | The list of outbound URIs                  | No       |
| `spec.outbound.uris[*].uri`               | The outbound URI                           | Yes      |
| `spec.outbound.uris[*].priority`          | Reserved for future use                    | NA       |
| `spec.outbound.uris[*].weight`            | Reserved for future use                    | NA       |
| `spec.outbound.uris[*].enabled`           | Reserved for future use                    | NA       |
| `spec.outbound.uris[*].transport`         | The transport of the outbound URI          | No       |
| `spec.outbound.uris[*].user`              | The user of the outbound URI               | No       |
| `spec.outbound.uris[*].host`              | The host of the outbound URI               | No       |
| `spec.outbound.uris[*].port`              | The port of the outbound URI               | No       |

An example of a Trunks configuration file:

Filename: `trunks.yaml`

```yaml
- apiVersion: v2beta1
  kind: Trunk
  ref: trunk-01
  metadata:
    name: Test Trunk
    region: us-east1
  spec:
    inbound:
      uri: trunk01.acme.com
      accessControlListRef: acl-01
    outbound:
      sendRegister: true
      credentialsRef: credentials-04
      uris:
        - uri:
            user: pbx-1
            host: sip.provider.net
            port: 7060
            transport: udp
          enabled: true
```

In the `spec.inbound` section, the `uri` property helps Routr to identify the Trunk. Calls from the PSTN using the `uri` will be routed to the Trunk. The `accessControlListRef` property restricts the access to the Trunk. The `accessControlListRef` is optional.

In the `spec.outbound` section, the `sendRegister` property enables registration outbound registrations while the `credentialsRef` property for authentication with your trunk provider.

In Routr, a Peer is a SIP entity that belongs to the same network as Routr. For example, Asterisk, FreeSWITCH, etc. The Peers configuration file has the following structure:

| Property                                  | Description                                | Required |
| ----------------------------------------- | ------------------------------------------ | -------- |
| `apiVersion`                              | The API version of the Peer                | Yes      |
| `kind`                                    | The kind of resource                       | Yes      |
| `ref`                                     | Reference to the Peer                      | Yes      |
| `metadata.name`                           | A friendly name for the Peer               | Yes      |
| `spec.aor`                                | The Address of Record (AOR) of the Peer    | Yes      |
| `spec.username`                           | The username of the Peer                   | Yes      |
| `spec.credentialsRef`                     | Reference to the Credentials of the Peer   | Yes      |
| `spec.loadBalancing.withSessionAffinity`  | Enables session affinity                   | No       |
| `spec.loadBalancing.algorithm`            | The load balancing algorithm               | No       |

The `spec.loadBalancing.withSessionAffinity` property enables session affinity, and the `spec.loadBalancing.algorithm` property sets the load-balancing algorithm. The available algorithms are `least-sessions` and `round-robin`.

Remember that for the `least-sessions` algorithm to work, your SIP backend includes the special header `X-Session-Count` with the number of active sessions as part of the registration request.

> We are evaluating more flexible options to provide the session count, but as of now, you also need to make sure that registration requests happen frequently enough to keep the session count up to date.

An example of a Peers configuration file:

Filename: `peers.yaml`

```yaml
- apiVersion: v2beta1
  kind: Peer
  ref: peer-01
  metadata:
    name: Asterisk (Media Server)
  spec:
    aor: sip:conference@sip.local
    username: asterisk
    credentialsRef: credentials-03
    loadBalancing:
     withSessionAffinity: true
     algorithm: least-sessions
```

Credentials in Routr help Agents and Peers authenticate with Routr.

The Credentials configuration file has the following structure:

| Property                                  | Description                                | Required |
| ----------------------------------------- | ------------------------------------------ | -------- |
| `apiVersion`                              | The API version of the Credentials         | Yes      |
| `kind`                                    | The kind of resource                       | Yes      |
| `ref`                                     | Reference to the Credentials               | Yes      |
| `metadata.name`                           | A friendly name for the Credentials        | Yes      |
| `spec.credentials.username`               | The username of the Credentials            | Yes      |
| `spec.credentials.password`               | The password of the Credentials            | Yes      |

An example of a Credentials configuration file:

Filename: `credentials.yaml`

```yaml
- apiVersion: v2beta1
  kind: Credentials
  ref: credentials-01
  metadata:
    name: Agent Credentials
  spec:
    credentials:
      username: "1001"
      password: "1234"
```

Routr also supports ACLs. ACLs are used to restrict access to Trunks and Domains. 

The ACLs configuration file has the following structure:

| Property                                  | Description                                | Required |
| ----------------------------------------- | ------------------------------------------ | -------- |
| `apiVersion`                              | The API version of the ACL                 | Yes      |
| `kind`                                    | The kind of resource                       | Yes      |
| `ref`                                     | Reference to the ACL                       | Yes      |
| `metadata.name`                           | A friendly name for the ACL                | Yes      |
| `spec.accessControlList.deny`             | The list of deny rules                     | No       |
| `spec.accessControlList.deny[*]`          | The deny rule                              | Yes      |
| `spec.accessControlList.allow`            | The list of allow rules                    | No       |
| `spec.accessControlList.allow[*]`         | The allow rule                             | Yes      |

An example of an ACLs configuration file:

Filename: `acl.yaml`

```yaml
- apiVersion: v2beta1
  kind: AccessControlList
  ref: acl-01
  metadata:
    name: Europe ACL
  spec:
    accessControlList:
      deny:
        - 0.0.0.0/1
      allow:
        - 192.168.1.3/31
        - 127.0.0.1/8
        - 10.111.221.22/31
```

## Communication and Protobuf Spec

Components communicate with the APIServer using gRPC. That includes SDKs, Command-line tools, Processors, Middleware, etc.

The following protobuf defines the Agent service interface:

```protobuf
syntax = "proto3";

package fonoster.routr.connect.agents.v2beta1;

// The Agents service definition
service Agents {
  // Creates a new Agent
  rpc Create (CreateAgentRequest) returns (Agent) {}
  // Updates an existing Agent
  rpc Update (UpdateAgentRequest) returns (Agent) {}
  // Gets an existing Agent
  rpc Get (GetAgentRequest) returns (Agent) {}
  // Deletes an existing Agent
  rpc Delete (DeleteAgentRequest) returns (.google.protobuf.Empty) {}
  // Lists all Agents
  rpc List (ListAgentsRequest) returns (ListAgentsResponse) {}
  // Find Agents by field name and value
  rpc FindBy (FindByRequest) returns (FindByResponse) {}
}

enum Privacy {
  PRIVATE = 0;
  NONE = 1;
}

// The message for the Agent resource
message Agent {
  // The API version of the Agent
  string api_version = 1;
  // The unique identifier of the Agent
  string ref = 2;
  // The name of the Agent
  string name = 3;
  // The username of the Agent
  string username = 4;
  // The password of the Agent
  Privacy privacy = 5;
  // The enabled status of the Agent
  bool enabled = 6;
  // The created_at timestamp of the Agent
  int32 created_at = 7;
  // The updated_at timestamp of the Agent
  int32 updated_at = 8;
  // The domain of the Agent
  fonoster.routr.connect.domains.v2beta1.Domain domain = 9;
  // The credentials of the Agent
  fonoster.routr.connect.credentials.v2beta1.Credentials credentials = 10;
  // The extended attributes of the Agent
  .google.protobuf.Struct extended = 11;  
}

// The request message for the Agents.Create method
message CreateAgentRequest {
  // The name of the Agent
  string name = 1;
  // The username of the Agent
  string username = 2;
  // The password of the Agent
  Privacy privacy = 3;
  // The enabled status of the Agent
  bool enabled = 4;
  // Reference to the Domain of the Agent
  string domain_ref = 5;
  // Reference to the Credentials of the Agent
  string credentials_ref = 6;
  // The extended attributes of the Agent
  .google.protobuf.Struct extended = 7;  
}

// The request message for the Agents.Update method
message UpdateAgentRequest {
  // The unique identifier of the Agent
  string ref = 1;
  // The name of the Agent
  string name = 2;
  // The privacy settings of the Agent
  Privacy privacy = 3;
  // The enabled status of the Agent
  bool enabled = 4;
  // Reference to the Domain of the Agent
  string domain_ref = 5;
  // Reference to the Credentials of the Agent
  string credentials_ref = 6;
  // The extended attributes of the Agent
  .google.protobuf.Struct extended = 7;
}

// The request message for the Agents.Get method
message GetAgentRequest {
  // The unique identifier of the Agent
  string ref = 1;
}

// The request message for the Agents.Delete method
message DeleteAgentRequest  {
  // The unique identifier of the Agent
  string ref = 1;
}

// The request message for the Agents.FindBy method
message FindByRequest {
  // The field name to search
  string field_name = 1;
  // The value to search
  string field_value = 2;
}

// The response message for the Agents.FindBy method
message FindByResponse {
  // The list of Agents
  repeated Agent items = 1;
} 

// The request message for the Agents.List method
message ListAgentsRequest {
  // The maximum number of items in the list
  int32 page_size = 1;

  // The next_page_token value returned from the previous request, if any
  string page_token = 2;
}

// The response message for the Agents.List method
message ListAgentsResponse {
  // List of Agents
  repeated Agent items = 1;

  // Token to retrieve the next page of results or empty if there are no more results in the list
  string next_page_token = 2;
}
```

To see the complete protobuf spec, please visit the [protobuf directory.](https://github.com/fonoster/routr/tree/main/mods/common/src/connect/protos)

## Launching the APIServer

Both implementations are available as Docker images from Docker Hub as `fonoster/routr-pgdata` and `fonoster/routr-simpledata`. 

**pgdata**

To launch the `pgdata` implementation with Docker, you can use the following command:

```bash
docker run -it \
  -e DATABASE_URL="postgresql://postgres:postgres@localhost:5432/routr" \
  -p 51907:51907 \
  -p 51908:51908 \
  fonoster/routr-pgdata
```

The port `51907` is used for internal communication, and the port `51908` is used for external communication. The CTL and SDK use the external port to manage the data.

**simpledata**

To launch the `simpledata` implementation with Docker, you can use the following command:

```bash
docker run -it \
  -v /path/to/resources:/etc/routr/resources \
  -p 51907:51907 \
  fonoster/routr-simpledata
```

## Quick Test with gRPCurl

One easy way to interact with the APIServer for testing and development is to use [gRPCurl](https://github.com/fullstorydev/grpcurl). The following example shows how to send a request to the Agents service within the APIServer:

```bash
grpcurl -plaintext \
  -import-path /path/to/protos \
  -proto agents.proto  -d '{...}' \
  localhost:51907 \
  fonoster.routr.connect.agents.v2beta1.Agents/Get
```

Please remember that the `simpledata` implementation does not accept write operations.
