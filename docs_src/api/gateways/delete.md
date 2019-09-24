Removes a Gateway resource from a persistent database. Before removing
a Gateway, ensure you have remove all of it child Numbers. Otherwise,
this method returns a `FOUND_DEPENDENT_OBJECTS_RESPONSE`

**URL**

`/gateways/{ref}`

**Method**

`DELETE`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference|

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method removes a Gateway resource.

**Sample Call**

```json
DELETE /api/v1beta1/gateways/gw5c77t2
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```
