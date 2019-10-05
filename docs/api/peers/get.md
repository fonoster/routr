This method returns a Peer resource.

**URL**

`/peers/{ref}`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference|

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns a Peer resource.

**Sample Call**

```json
GET /api/v1beta1/peers/pr2c77f4
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request",
  "data" : {
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
}
```
