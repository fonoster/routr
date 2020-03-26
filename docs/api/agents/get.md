This method returns an Agent resource.

**URL**

`/agents/{ref}`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference |

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns an Agent resource.

**Sample Call**

```json
GET /api/v1beta1/agents/ag3f77f6
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request",
  "data" : {
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
}
```
