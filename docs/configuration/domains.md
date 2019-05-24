Domains group Agents together. They help isolate groups and allow the creation of rule for incoming and
outgoing calling. The domains configuration can be provided using the file `config/domains.yml` located at the root of your Routr installation.

> If using Redis this configuration gets stored in the database.

## Domain Resource

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented)| Yes |
| kind | Defines the type of resource | Yes |
| metadata.name | Friendly name for the SIP domain | Yes |
| spec.context.domainUri | Domain URI. FQDN is recommended | Yes |
| spec.context.egressPolicy.rule | Regular expression indicating when a call will be routed via $spec.context.egressPolicy.didRef | No |
| spec.context.egressPolicy.didRef | Reference to the DID that will route the call | No |
| spec.context.accessControlList.allow[*] | Traffic allow for Network in list | No |
| spec.context.accessControlList.deny[*] | Traffic disabled for Network in list| No |

ACL Rules may be in CIDR, IP/Mask, or single IP format. Example of rules are:

- 0.0.0.0/1 # all
- 192.168.1.0/255.255.255.0
- 192.168.0.1/31

## Example

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
