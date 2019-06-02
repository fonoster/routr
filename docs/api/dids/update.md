Updates an existing DID resource.

**URL**

`/dids/{ref}`

**Method**

`PUT`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [DID](/configuration/dids) resource in `json` format.

**Response**

If successful this method updates a DID resource.

**Sample Call**

```json
PUT /api/v1beta1/dids/dd50baa4
{
  "apiVersion": "v1beta1",
  "kind": "DID",
  "metadata": {
    "ref": "dd50baa4",
    "gwRef": "gweef506",
    "geoInfo": {
      "city": "City, State",
      "country": "Country",
      "countryISOCode": "US"
    }
  },
  "spec": {
    "location": {
      "telUrl": "tel:0000000000",
      "aorLink": "sip:1001@sip.local"
    }
  }
}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```
