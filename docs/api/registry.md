This method gets a list of available(online) gateways.

**URL**

`/registry`

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

This method returns a list with registered devices.

**Sample Call**

```json
GET /api/{apiversion}/registry
{

}

HTTP/1.1 200 OK
{  
  "status":200,
  "message":"Successful request",
  "data":[]
}
```
