Gets a list of registered devices.

**URL**

`/location`

**Method**

`GET`

**Parameters**

This method does not receive any parameters.

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
   "status":200,
   "message":"Successful request",
   "data":[  
      {  
         "addressOfRecord":"sip:1001@sip.local",
         "contactInfo":"sip:45962087@192.168.1.127:59985;transport=tcp;nat=false;expires=600"
      }
   ]
}
```
