The general configuration affects your entire Routr instance. The general configuration
can be provided using the file `config/config.yml` located at the root of your Routr installation.

## General Configuration Parameters

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
| spec.addressInfo.[*] | Custom tag with the DID information | No |
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
| spec.securityContext.debugging | Turns ON or OFF ssl debugging. Default is `false` | No |
| spec.dataSource.provider | Defines data provider. Defaults to `files_data_provider` | No |
| spec.dataSource.parameters | Implementation specific parameters | No |
| spec.logging.traceLevel | Verbosity of the sip-stack logging. Default is `0` | No |

## Transport Configuration

Routr supports `tcp`, `udp`, `tls`, `sctp`, `ws`, and `wss` as transport protocols.

To operate, the server requires of at least one transport protocol.
To bind a transport protocol to an specific IP address you can use the `spec.transport.bindAddr`,
otherwise the `spec.bindAddr` will be use.

## Datasource Providers

Routr currently implements three data providers: `redis_data_provider`, `files_data_provider` and `restful_data_provider`. The default data provider is the `files_data_provider`.

> The docker distribution of the server uses `redis_data_provider` by default

### Redis Data Provider

The parameters for `redis_data_provider` are:

| Parameter | Description | Required |
| --- | --- | --- |
| host | Redis host. Defaults to 'localhost' | No |
| port | Redis port. The default port is 6379 | No |
| secret | Password to access database | No |

### Files Data Provider

The parameters for `files_data_provider` are:

| Parameter | Description | Required |
| --- | --- | --- |
| path | Path to configuration files. Defaults to 'config' folder | No |

This implementation has the limitation that writes operations have to be performed manually on the files.

### Restful Data Provider

The parameters for `restful_data_provider` are:

| Parameter | Description | Required |
| --- | --- | --- |
| baseUrl | Endpoint base url | yes |
| username | Basic authentication username | yes |
| secret | Basic authentication password | yes |

## Configuring the server behind a NAT

The `spec.externAddr` and `spec.localnets` parameters help Routr identify the
correct path for any given traffic. The `spec.externAddr` is typically the Internet
facing IP address. The `spec.localnets` is array with valid CIDR, IP/Mask, or single IP values.
here is quick example:

```yaml
spec:
  externAddr: 172.220.231.23
  localnets: [172.17.0.2/16]
```

## Access Control List

The Access Control List(ACL) provides with a security mechanism to disable network
access from unwanted sources. ACL can be define per Domain basis. Here are example,
blocking all traffic except from IP address `192.168.0.1`.

```yaml
spec:
  accessControlList:
    deny: [0.0.0.0/1]        # Deny all
    allow: [192.168.0.1/31]
```

## Basic Example

```yaml
apiVersion: v1beta1
spec:
  transport:
    - protocol: tcp
      port: 5060
    - protocol: udp
      port: 5060
```
