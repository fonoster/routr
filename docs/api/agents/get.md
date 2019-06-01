This method returns an Agent resource.

**URL**

`/agents/{ref}`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference|

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns an Agent resource.

**Sample Call**

```json
GET /api/{apiversion}/agents/{ref}
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```
