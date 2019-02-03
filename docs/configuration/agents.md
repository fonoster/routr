## Agent Resource

> This file can be found at 'config/agents.yml' in the root of this project.

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
