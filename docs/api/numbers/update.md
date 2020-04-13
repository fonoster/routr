Updates an existing Number.

**URL**

`/numbers/{ref}`

**Method**

`PUT`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [Number](/configuration/numbers) resource in `json` format.

**Response**

If successful this method updates a Number.

**Sample Call**

```json
PUT /api/v1beta1/numbers/dd50baa4
{
  "apiVersion": "v1beta1",
  "kind": "Number",
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
{
  "status": "200",
  "message": "Successful request"
}
```
