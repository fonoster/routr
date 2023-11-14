# getConfiguration

This method returns the servers' configuration.

**URL**

`/system/config`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| full |  query  | boolean | If set to `true` it will return a merged configuration between defaults and user defined values|

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns the current configuration from the server.

**Sample Call**

```json
GET /api/{apiversion}/system/config
{

}

HTTP/1.1 200 OK
{
  "status": 200,
  "message": "Successful request",
  "data": {
    ...
  }
}
```
