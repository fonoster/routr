Evicts an entry from the location table

**URL**

`/location/{addressOfRecord}`

**Method**

`DELETE`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| addressOfRecord |  path | string | Address of record for the entry |

**Request body**

Do not supply a request body with this method.

**Response**

This method removes and entry for the give address of record

**Sample Call**

```json
DELETE /api/{apiversion}/location/sip:guest@guest
{

}

HTTP/1.1 200 OK
{
  "status": 200,
  "message": "Location entry evicted"
}
```
