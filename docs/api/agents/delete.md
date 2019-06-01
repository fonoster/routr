Removes an Agent resource from a persistent database.

**URL**

`/agents/{ref}`

**Method**

`DELETE`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference|

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method removes an Agent resource.

**Sample Call**

```json
DELETE /api/{apiversion}/agents/{ref}
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```
