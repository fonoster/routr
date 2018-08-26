---
id: api-resources
title: Resource Files
---

**Routr** API version is currently `v1beta1`. We will continue to improve the API, resource definition, and other artifacts until we reach a final version. We then will establish an update policy to ensure backward compatibility. Until then keep an eye on this document.

## General Configuration

> This file can be found at 'config/config.yaml' in the root of this project.

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented) | yes |
| metadata.userAgent| Sets sip header `User-Agent` to the desired value | No |
| spec.bindAddr | Default stack IP address  | No |
| spec.externAddr | IP address to advertise | No |
| spec.localnets | Local networks. Use in combination with spec.externAddr | No |
| spec.recordRoute | Stay within the signaling path | No |
| spec.useToAsAOR | Use the TO header instead of Request URI | No |
| spec.registrarIntf | Force to use received & rport for registration| No |
| spec.addressInfo.[*] | Custom tag with the did information | No |
| spec.accessControlList.deny.[*] | Deny incoming traffic from network list | No |
| spec.accessControlList.allow.[*] | Allow incoming traffic from network list | No |
| spec.restService.bindAddr | Restful service listening address | No |
| spec.restService.port | Restful service port. Defaults to 4567 | No |
| spec.restService.unsecured | Disabled https for restful calls. Default is `false` | No |
| spec.restService.keyStore | Path to keyStore | No |
| spec.restService.trueStore | Path to trueStore | No |
| spec.restService.keyStorePassword | Password for keyStore | No |
| spec.restService.trueStorePassword | Password for trueStore | No |
| spec.transport.bindAddr | Overwrites `spec.bindAddr` for transport entry | No |
| spec.transport.port | Transport port | Yes |
| spec.transport.protocol | Valid values are: `tcp`, `udp`, `tls`, `sctp`, `ws`, `wss` | Yes |
| spec.securityContext.keyStore | Path to keyStore  | Yes |
| spec.securityContext.trustStore | Path to trueStore  | Yes |
| spec.securityContext.keyStorePassword | Password for keyStore  | Yes |
| spec.securityContext.keyStoreType | KeyStore type  | Yes |
| spec.securityContext.client.authType | Type of client authentication. Default is `Disabled`. See https://goo.gl/1vKbXW for more options | No |
| spec.securityContext.client.protocols.[*] | Accepted tls protocols. Default is [`TLSv1.2`, `TLSv1.1`, `TLSv1`] | No |
| spec.securityContext.debugging | Turns ON or OFF ssl debuging. Default is `false` | No |
| spec.dataSource.provider | Defines data provider. Defaults to `files_data_provider` | No |
| spec.dataSource.parameters | Parameters expecifics to data provider implementation | No |
| spec.logging.traceLevel | Verbosity of the sip-stack logging. Default is `0` | No |

**Example**

```yaml
apiVersion: v1beta1
metadata:
  userAgent: Routr v1.0
spec:
  transport:
    - protocol: udp
      port: 5060
  dataSource:
    provider: redis_data_provider
  logging:
    traceLevel: 10
```

### Data Providers

Routr currently implements three data providers: `redis_data_provider`, `files_data_provider` and `restful_data_provider`. The default data provider is the `files_data_provider`.

> The docker version of the server uses `redis_data_provider` as its default

The parameters for `redis_data_provider` are:

| Parameter | Description | Required |
| --- | --- | --- |
| host | Redis host. Defaults to 'localhost' | No |
| port | Redis port. The default port is 6379 | No |
| secret | Password to access database | No |

The parameters for `files_data_provider` are:

| Parameter | Description | Required |
| --- | --- | --- |
| path | Path to configuration files. Defaults to 'config' folder | No |

This implementation has the limitation that writes operations have to be performed manually on the files.

The parameters for `restful_data_provider` are:

| Parameter | Description | Required |
| --- | --- | --- |
| baseUrl | Endpoint base url | yes |
| username | Basic authentication username | yes |
| secret | Basic authentication password | yes |

## User Resource

> This file can be found at 'config/users.yaml' in the root of this project.

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented)| Yes |
| kind | Defines the type of resource | Yes |
| metadata.name | Friendly name for the User device | Yes |
| spec.credentials.username | User's credential username | Yes |
| spec.credentials.secret | User's credential secret | Yes |

**Example**

```yaml
# Users exist in Routr to perform administrative actions on the server
- apiVersion: v1beta1
  kind: User
  metadata:
    name: Administrator
  spec:
    credentials:
      username: admin
      secret: changeit
```

## Agent Resource

> This file can be found at 'config/agents.yaml' in the root of this project.

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented)| Yes |
| kind | Defines the type of resource | Yes |
| metadata.name | Friendly name for the SIP device | Yes |
| spec.credentials.username | Agent's credential username | Yes |
| spec.credentials.secret | Agent's credential secret | Yes |
| spec.domains[*] | Context/s in which this Agent is allowed to communicate. FQDN is recommended | Yes |

**Example**

```yaml
# Peers and Agents can register in Routr location service
- apiVersion: v1beta1
  kind: Agent
  metadata:
    name: John Doe
  spec:
    credentials:
      username: john
      secret: '1234'
    domains: [sip.local]
```

## Domain Resource

> This file can be found at 'config/domains.yaml' in the root of this project.

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented)| Yes |
| kind | Defines the type of resource | Yes |
| metadata.name | Friendly name for the SIP domain | Yes |
| spec.context.domainUri | Domain URI. FQDN is recomended | Yes |
| spec.context.egressPolicy.rule | Regular expression indicating when a call will be routed via $spec.context.egressPolicy.didRef | No |
| spec.context.egressPolicy.didRef | Reference to the DID that will route the call | No |
| spec.context.accessControlList.allow[*] | Traffic allow for Network in list | No |
| spec.context.accessControlList.deny[*] | Traffic disabled for Network in list| No |

> Access Control List
> Rules may be in CIDR, IP/Mask, or single IP format. Example
> of rules are:
> - 0.0.0.0/1 # all
> - 192.168.1.0/255.255.255.0
> - 192.168.0.1/31

**Example**

```yaml
- apiVersion: v1beta1
  kind: Domain
  metadata:
    name: Local Server
  spec:
    context:
      domainUri: sip.local
      egressPolicy:
        rule: .*
        didRef: DID0001
      accessControlList:
        deny: [0.0.0.0/1]     # Deny all
        allow: [192.168.0.1/31]
```

## Gateway Resource

> This file can be found at 'config/gateways.yaml' in the root of this project.

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented)| Yes |
| kind | Defines the type of resource | Yes |
| metadata.name | Friendly name for the SIP device | Yes |
| metadata.ref | Reference to this resource | Yes |
| spec.credentials.username | Gateway username | Yes |
| spec.credentials.secret |  Gateway secret  | Yes |
| spec.host | Gateway host | Yes |
| spec.transport | Transport protocol | Yes |
| spec.registries.[*] | Additional registries for ingress calls | No |

**Example**

```yaml
# Use gateway to register with a Sip Gateways or SBCs and send
# or receive calls from the PSTN
- apiVersion: v1beta1
  kind: Gateway
  metadata:
    name: Provider, Inc
    ref:  GW0001
  spec:
    host: sip.provider.com
    transport: tcp
    credentials:
      username: 'user'
      secret: changeit
```

## DID Resource

> This file can be found at 'config/dids.yaml' in the root of this project.

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented) | Yes |
| kind | Defines the type of resource | Yes |
| metadata.ref| Reference to this resource | Yes |
| metadata.gwRef| Reference to parent Gateway | Yes |
| metadata.geoInfo.city | City of the DID | No |
| metadata.geoInfo.country | Country of the DID | No |
| metadata.geoInfo.countryISOCode| Country ISO code for the DID (ie.: US) | No |
| spec.location.telUrl | DID URI available in the location server | Yes |
| spec.location.aorLink | Address of record of SIP device for call routing | Yes |

**Example**

```yaml
- apiVersion: v1beta1
  kind: DID
  metadata:
    ref: DID0001
    gwRef: GW0001
    geoInfo:
      city: Columbus, GA
      country: USA
      countryISOCode: US
  spec:
    location:
      telUrl: 'tel:17066041487'
      aorLink: 'sip:john@sip.local'
```

## Peer Resource

> This file can be found at 'config/peers.yaml' in the root of this project.

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented) | Yes |
| kind | Defines the type of resource | Yes |
| metadata.name | Friendly name for the SIP device | Yes |
| spec.credentials.username | Peer's credential username | Yes |
| spec.credentials.secret | Peer's credential secret | Yes |
| spec.device | When set it will be used by the location service  | No |
| spec.contactAddr | When set will advertise this as the contactURI | No |

**Example**

```yaml
# Peers and Agents can register on Routr location service
- apiVersion: v1beta1
  kind: Peer
  metadata:
    name: Asterisk (Media Server)
  spec:
    credentials:
      username: ast
      secret: 'astsecret'
    device: astserver      # If is not define the IP address will be use
    contactAddr: '192.168.1.2:6060'
```

This peer can be reached using `ast@astserver`.
