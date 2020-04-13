This method returns information about the server.

**URL**

`/system/status/{status}`

**Method**

`POST`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| status |  path | string | This accepts either `down` or `restarting` parameters |
| filter |  now  | boolean | If set to `true` it will not wait for current calls to finish |

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method causes the server to change its status.

**Sample Call**

```json
POST /api/v1beta1/system/status/reload
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Request sent to server"
}
```
