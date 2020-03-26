This method returns an Agent resource.

**URL**

`/numbers/{ref}`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference |

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns a Number.

**Sample Call**

```json
GET /api/v1beta1/numbers/dd50baa4
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request",
  "data" : {
  	"apiVersion": "v1beta1",
  	"kind": "Number",
  	"metadata": {
      "ref": "dd50baa4",
  		"gwRef": "gweef506",
  		"geoInfo": {
  			"city": "City, State",
  			"country": "Country",
  			"countryISOCode": "US"
  		}
  	},
  	"spec": {
  		"location": {
  			"telUrl": "tel:0000000000",
  			"aorLink": "sip:1001@sip.local"
  		}
  	}
  }
}
```
