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
   "status": 200,
   "message": "Successful request",
   "meta": {
      "currentPage": 1,
      "totalPages": 1,
      "itemsPerPage": 30,
      "totalItems": 1
   },
   "data": [
      {
         "username": "215706",
         "host": "atlanta2.voip.ms",
         "ip":"209.217.224.50",
         "expires": 3600,
         "registeredOn": 1588525156280,
         "gwRef": "gw50a1a4ca",
         "gwURI": "sip:215706@atlanta2.voip.ms:5060",
         "regOnFormatted": "a few seconds ago"
      }
   ]
}
```
