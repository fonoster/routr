# createDomain

Creates a new Domain resource.

**URL**

`/domains`

**Method**

`POST`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [Domain](/docs/configuration/domains) resource in `json` format.

**Response**

If successful this method creates a Domain resource.

**Sample Call**

```json
POST /api/{apiversion}/domains
{
	"apiVersion": "v1beta1",
	"kind": "Domain",
	"metadata": {
		"name": "Another Office"
	},
	"spec": {
		"context": {
			"domainUri": "sip2.local"
		}
	}
}

HTTP/1.1 201 Created
{
	"status": "201",
	"message": "Created",
	"data": "dm6c87r2"
}
```
