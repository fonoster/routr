DIDs represent virtual numbers use to route calls from/to the PSTN through Gateways.

The DIDs configuration can be provided using the file `config/dids.yml` located at the root of your Routr installation.

> If using Redis this configuration gets stored in the database.

## DID Resource

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented) | Yes |
| kind | Defines the type of resource | Yes |
| metadata.ref| Reference to this resource | Yes |
| metadata.gwRef| Reference to parent Gateway | Yes |
| metadata.geoInfo.city | City of the DID | No |
| metadata.geoInfo.country | Country of the DID | No |
| metadata.geoInfo.countryISOCode| The Country ISO code for the DID (i.e., US) | No |
| spec.location.telUrl | DID URI available in the location server | Yes |
| spec.location.aorLink | Address of record of SIP device for call routing | Yes |

## Example

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
