Gets a list of registered devices.

**URL**

`/location`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| page   |  query | number | Pagination index |
| itemsPerPage |  query | number | Number of elements per request |

**Request body**

Do not supply a request body with this method.

**Response**

This method returns a list with registered devices in
the response body.

**Sample Call**

```json
GET /api/{apiversion}/location
{

}

HTTP/1.1 200 OK
{  
  "status": 200,
  "message": "Successful request",
  "meta": {
    "currentPage": 1,
    "totalPages": 1,
    "itemsPerPage": 30,
    "totalItems": 1
  },   
  "data":[{  
    "addressOfRecord": "sip:1001@sip.local",
    "contactInfo": "sip:45962087@192.168.1.127:59985;transport=tcp;nat=false;expires=600"
  }]
}
```
