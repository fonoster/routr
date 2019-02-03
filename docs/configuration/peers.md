## Peer Resource

> This file can be found at 'config/peers.yml' in the root of this project.

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
    device: astserver      # If is not define the IP address will be used
    contactAddr: '192.168.1.2:6060'
```

This peer can be reached using `ast@astserver`.
