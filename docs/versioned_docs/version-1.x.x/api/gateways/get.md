# getGateway

This method returns a Gateway resource.

**URL**

`/gateways/{ref}`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference |

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns a Gateway resource.

**Sample Call**

```json
GET /api/{apiversion}/gateways/gw5c77t2
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request",
  "data" : {
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
}
```
