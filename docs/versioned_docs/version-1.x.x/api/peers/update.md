# updatePeer

Updates an existing Peer resource.

**URL**

`/peers/{ref}`

**Method**

`PUT`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [Peer](../../configuration/peers.md) resource in `json` format.

**Response**

If successful this method updates a Peer resource.

**Sample Call**

```json
PUT /api/v1beta1/peers/pr2c77f4
{
	"apiVersion": "v1beta1",
	"kind": "Peer",
	"metadata": {
		"name": "Asterisk PBX",
    "ref": "pr2c77f4"
	},
	"spec": {
		"credentials": {
			"username": "ast",
			"secret": "1234"
		}
	}
}

HTTP/1.1 200 OK
{
	"status": "200",
	"message": "Successful request"
}
```
