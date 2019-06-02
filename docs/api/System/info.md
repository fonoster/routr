This method returns information about the server.

**URL**

`/system/info`

**Method**

`GET`

**Parameters**

This method does not receive any parameters.

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns relevant information about the server.

**Sample Call**

```json
GET /api/v1beta1/system/info
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request",
  "result" : {
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
