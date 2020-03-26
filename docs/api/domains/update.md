Updates an existing Domain resource.

**URL**

`/domains/{ref}`

**Method**

`PUT`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [Domain](/docs/configuration/domains) resource in `json` format.

**Response**

If successful this method updates a Domain resource.

**Sample Call**

```json
PUT /api/v1beta1/domains/dm6c87r2
{
	"apiVersion": "v1beta1",
	"kind": "Domain",
	"metadata": {
		"name": "Another Office",
    "ref": "dm6c87r2"
	},
	"spec": {
		"context": {
			"domainUri": "sip2.local"
		}
	}
}

HTTP/1.1 200 OK
{ "status": "200", "Successful request" }
```
