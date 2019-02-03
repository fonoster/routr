## Gateway Resource

> This file can be found at 'config/gateways.yml' in the root of this project.

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
| spec.expires | Requested lifespan of the registration in seconds. Defaults to `3600` | No |
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
