This method returns a list of Gateways resources.

**URL**

`/gateways`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| filter |  query | string | Use filter to narrow the elements shown. |

Note: The filter parameter uses [JsonPath](https://github.com/json-path/JsonPath) format

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns a list of Gateways resources.

**Sample Call**

```json
GET /api/v1beta1/gateways
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request",
  "result" : [{
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
  }]
}
```
