Updates an existing Gateway resource.

**URL**

`/gateways/{ref}`

**Method**

`PUT`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [Gateway](/configuration/gateways) resource in `json` format.

**Response**

If successful this method updates a Gateway resource.

**Sample Call**

```json
PUT /api/v1beta1/gateways/gw5c77t2
{
	"apiVersion": "v1beta1",
	"kind": "Gateway",
	"metadata": {
		"name": "Provider Inc.",
		"ref": "gw5c77t2"
	},
	"spec": {
		"host": "sip.provider.net",
		"credentials": {
			"username": "youruser",
			"secret": "yoursecret"
		},
		"transport": "udp"
	}
}

HTTP/1.1 200 OK
{
	"status": "200",
	"message": "Successful request"
}
```
