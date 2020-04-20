This method returns a Gateway resource.

**URL**

`/domains/{ref}`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference |

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns a Domain resource.

**Sample Call**

```json
GET /api/{apiversion}/domains/dm6c87r2
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request",
  "data" : {
  	"apiVersion": "v1beta1",
  	"kind": "Domain",
  	"metadata": {
  		"name": "Another Office",
      "ref": "dm6c87r2"
  	},
  	"spec": {
  		"context": {
  			"domainUri": "sip2.local"
  		}
  	}
  }
}
```
