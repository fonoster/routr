# Gateways

Use the Gateway resource to register with a SIP Gateways or SBCs and send or receive calls from the PSTN.

The Gateways configuration can be provided using the file `config/gateways.yml`. The file is located at the root of your Routr installation, or as defined in the environment variable `CONFIG_FILE.`

> If using Redis this configuration gets stored in the database.

For static IP authentication be sure to properly configure the `spec.externAddr` and `spec.localnets` in `config.yml`.

## Gateway Resource

| Property                  | Description                                                          | Required |
|---------------------------|----------------------------------------------------------------------|----------|
| apiVersion                | Indicates the version of the resource (Not yet implemented)          | Yes      |
| kind                      | Defines the type of resource                                         | Yes      |
| metadata.name             | Friendly name for the SIP device                                     | Yes      |
| metadata.ref              | Reference to this resource                                           | No       |
| spec.sendRegister         | Send SIP REGISTER package to gateway host. Defaults to `false`       | No       |
| spec.credentials.username | Gateway username. No required for static IP authentication           | No       |
| spec.credentials.secret   | Gateway secret. No required for static IP authentication             | No       |
| spec.host                 | Gateway host                                                         | Yes      |
| spec.transport            | Transport protocol                                                   | Yes      |
| spec.expires              | Requested lifespan of the registration in seconds. Defaults to `600` | No       |
| spec.registries.[*]       | Additional registries for ingress calls                              | No       |

## Example of Gateway in `Registration Mode`

```yaml
- apiVersion: v1beta1
  kind: Gateway
  metadata:
    name: Provider, Inc
    ref: GW0001
  spec:
    host: sip.provider.com
    transport: tcp
    credentials:
      username: 'user'
      secret: changeit
```

## Example if Gateway using `Static Mode`

```yaml
- apiVersion: v1beta1
  kind: Gateway
  metadata:
    name: Provider 2, Inc
    ref: GW0002
  spec:
    host: sip2.provider.com
    port: 5080
    transport: tcp
```
