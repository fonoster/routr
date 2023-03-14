Creates a new Agent resource. The Domain must exist before creating the Agent.
Otherwise, this method responds with a `UNFULFILLED_DEPENDENCY_RESPONSE`.

**URL**

`/agents`

**Method**

`POST`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing an [Agent](/configuration/agents) resource in `json` format.

**Response**

If successful this method creates an Agent resource.

**Sample Call**

```json
POST /api/{apiversion}/agents
{
  "apiVersion": "v1beta1",
  "kind": "Agent",
  "metadata": {
  	"name": "John Doe"
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

HTTP/1.1 201 Created
{
  "status": "201",
  "message": "Created",
  "data": "ag3f77f6"
}
```
