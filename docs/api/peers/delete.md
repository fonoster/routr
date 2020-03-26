Removes a Peer resource from a persistent database.

**URL**

`/peers/{ref}`

**Method**

`DELETE`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference|

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method removes a Peer resource.

**Sample Call**

```json
DELETE /api/v1beta1/peers/pr2c77f4
{

}

HTTP/1.1 200 OK
{ "status": "200", "Successful request" }
```
