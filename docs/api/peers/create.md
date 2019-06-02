Creates a new Peer resource.

**URL**

`/peers`

**Method**

`POST`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [Peer](/configuration/peers) resource in `json` format.

**Response**

If successful this method creates a Peer resource.

**Sample Call**

```json
POST /api/v1beta1/peers
{
	"apiVersion": "v1beta1",
	"kind": "Peer",
	"metadata": {
		"name": "Asterisk PBX"
	},
	"spec": {
		"credentials": {
			"username": "ast",
			"secret": "1234"
		}
	}
}

HTTP/1.1 201 Created
{"status": "201", "message": "Created"}
```
