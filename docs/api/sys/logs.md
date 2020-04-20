This method returns logs from the server

**URL**

`/system/logs`

**Method**

`GET`

**Parameters**

This method does not receive any parameters.

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns logging information from the server.

**Sample Call**

```json
GET /api/{apiversion}/system/logs
{

}

HTTP/1.1 200 OK
{
   "status":200,
   "message":"Successful request",
   "data":"[DEBUG] 2020-04-13 12:29:49.785..."
}
