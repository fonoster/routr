# checkSystemStatus

Pings an instance of Routr engine.

**URL**

`/system/status`

**Method**

`GET`

**Parameters**

This method does not receive any parameters.

**Request body**

Do not supply a request body with this method.

**Response**

If successful, this method will return a `status = 200`. A client implementing
this method can assumed that no answer or a bad answer means that the server
us down or "unhealthy."

**Sample Call**

```json
GET /api/{apiversion}/system/status
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request",
  "data": "up"
}
```
