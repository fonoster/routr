Like Agents, Peers represent SIP endpoints such as Media Servers.
Unlike Agents, Peers aren't bound to a Domain.

The Peers configuration can be provided using the file `config/peers.yml` located at the root of your Routr installation.

> If using Redis this configuration will be store in the database.

## Peer Resource

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented) | Yes |
| kind | Defines the type of resource | Yes |
| metadata.name | Friendly name for the SIP device | Yes |
| spec.credentials.username | Peer's credential username | Yes |
| spec.credentials.secret | Peer's credential secret | Yes |
| spec.device | When set it will be used by the location service  | No |
| spec.contactAddr | When set will advertise this as the contactURI | No |

## Example

```yaml
- apiVersion: v1beta1
  kind: Peer
  metadata:
    name: Asterisk (Media Server)
  spec:
    credentials:
      username: ast
      secret: 'astsecret'
    device: astserver      # If is not define the IP address will be used
    contactAddr: '192.168.1.2:6060'
```

> This peer can be reached using the AOR: `ast@astserver`.
