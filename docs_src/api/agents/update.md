Updates an existing Agent resource.

**URL**

`/agents/{ref}`

**Method**

`PUT`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing an [Agent](/configuration/agents) resource in `json` format.

**Response**

If successful this method updates an Agent resource.

**Sample Call**

```json
PUT /api/v1beta1/agents/ag3f77f6
{
    "apiVersion": "v1beta1",
    "kind": "Agent",
    "metadata": {
      "name": "John Doe",
      "ref": "ag3f77f6"
    },
    "spec": {
    	"credentials": {
    		"username": "1001",
    		"secret": "1234"
    	},
    	"domains": [
    		"sip.local"
    	]
    }
}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```
