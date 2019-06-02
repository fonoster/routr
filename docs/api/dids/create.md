Creates a new DID resource. The Gateway must exist before creating the DID.
Otherwise, this method responds with a `UNFULFILLED_DEPENDENCY_RESPONSE`.

**URL**

`/dids`

**Method**

`POST`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [DID](/configuration/dids) resource in `json` format.

**Response**

If successful this method creates an DID resource.

**Sample Call**

```json
POST /api/v1beta1/dids
{
	"apiVersion": "v1beta1",
	"kind": "DID",
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
{"status": "201", "message": "Created"}
```
