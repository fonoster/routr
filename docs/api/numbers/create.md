Creates a new Number. The Gateway must exist before creating the Number.
Otherwise, this method responds with a `UNFULFILLED_DEPENDENCY_RESPONSE`.

**URL**

`/numbers`

**Method**

`POST`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [Number](/configuration/numbers) resource in `json` format.

**Response**

If successful this method creates a Number.

**Sample Call**

```json
POST /api/{apiversion}/numbers
{
	"apiVersion": "v1beta1",
	"kind": "Number",
	"metadata": {
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

HTTP/1.1 201 Created
{
	"status": "201",
	"message": "Created",
	"data": "dd50baa4"
}
```
