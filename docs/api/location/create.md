Adds an entry into the location table

**URL**

`/location/{addressOfRecord}`

**Method**

`POST`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| addressOfRecord |  path | string | Address of record for the new entry |

**Request body**

Supply a json containing an address, port, expires, user values.

**Response**

This method adds an entry to the location table. Useful for end-to-end testing.

**Sample Call**

```json
POST /api/{apiversion}/location/sip:guest@guest
{
  "user": "guest",
  "address": "192.168.1.149",
  "port": 5080,
  "expires": 3600
}

HTTP/1.1 200 OK
{
  "status": 200,
  "message": "Added location entry"
}
```
