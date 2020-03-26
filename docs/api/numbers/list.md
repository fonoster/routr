This method returns a list of Numbers.

**URL**

`/numbers`

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

If successful this method returns a list of Numbers.

**Sample Call**

```json
GET /api/v1beta1/numbers
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
  }]
}
```
