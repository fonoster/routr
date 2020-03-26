This method returns a list of Peer resources.

**URL**

`/peers`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| filter |  query | string | Use filter to narrow the elements shown |
| page   |  query | number | Pagination index |
| itemsPerPage |  query | number | Number of elements per request |

Note: The filter parameter uses [JsonPath](https://github.com/json-path/JsonPath) format

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns a list of Peer resources.

**Sample Call**

```json
GET /api/v1beta1/peers
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request",
  "meta": {
    "currentPage": 1,
    "totalPages": 1,
    "itemsPerPage": 30,
    "totalItems": 1
  },  
  "data" : [{
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
  }]
}
```
