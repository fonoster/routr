This method returns a list of Agent resources.

**URL**

`/agents`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| filter |  query | string | Use filter to narrow the elements shown. |

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns a list of Agent resources.

**Sample Call**

```json
GET /api/{apiversion}/agents
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```
