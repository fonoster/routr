Creates a new Gateway resource.

**URL**

`/gateways`

**Method**

`POST`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [Gateway](/configuration/gateways) resource in `json` format.

**Response**

If successful this method creates a Gateway resource.

**Sample Call**

```json
POST /api/{apiversion}/gateways
{
	"apiVersion": "v1beta1",
	"kind": "Gateway",
	"metadata": {
		"name": "Provider Inc."
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


HTTP/1.1 201 Created
{
	"status": "201",
	"message": "Created",
	"data": "gw5c77t2"
}
```
