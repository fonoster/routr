Removes an Agent resource from a persistent database.

**URL**

`/agents/{ref}`

**Method**

`DELETE`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference |

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method removes an Agent resource.

**Sample Call**

```json
DELETE /api/v1beta1/agents/ag3f77f6
{

}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request"
}
```
