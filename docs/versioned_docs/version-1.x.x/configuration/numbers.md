# Numbers

Numbers represent virtual numbers used to route calls from/to the PSTN through Gateways.

The Numbers configuration can be provided using the file `config/numbers.yml` located at the root of your Routr installation.

> If using Redis this configuration gets stored in the database.

## Number Resource

| Property | Description | Required |
| --- | --- | --- |
| apiVersion | Indicates the version of the resource (Not yet implemented) | Yes |
| kind | Defines the type of resource | Yes |
| metadata.ref| Reference to this resource | No |
| metadata.gwRef| Reference to parent Gateway | Yes |
| metadata.geoInfo.city | City of the Number | No |
| metadata.geoInfo.country | Country of the Number | No |
| metadata.geoInfo.countryISOCode| The Country ISO code for the Number (i.e., US) | No |
| spec.location.telUrl | Number URI available in the location server | Yes |
| spec.location.aorLink | Address of record of SIP device for call routing | Yes |

## Example

```yaml
- apiVersion: v1beta1
  kind: Number
  metadata:
    ref: Number0001
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
