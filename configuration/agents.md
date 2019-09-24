Agents represent SIP endpoints such as softphones, IP phones, or paging speakers.
A Domain binds agents together. An Agent can belong to one or multiple Domains.

The Agents configuration can be provided using the file `config/agents.yml` located at the root of your Routr installation.

> If using Redis this configuration gets stored in the database.

## Agent Resource

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented)| Yes |
| kind | Defines the type of resource | Yes |
| metadata.name | Friendly name for the SIP device | Yes |
| spec.privacy | If set to `Private` the server removes identifiable information for the requests. Defaults to `None` | No |
| spec.credentials.username | Agent's credential username | Yes |
| spec.credentials.secret | Agent's credential secret | Yes |
| spec.domains[*] | Context/s in which this Agent is allowed to communicate. FQDN is recommended | Yes |

## Example

```yaml
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
