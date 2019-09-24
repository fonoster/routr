Removes a Domain resource from a persistent database. Before removing
a Domain, ensure you have remove all of it child Agents. Otherwise,
this method returns a `FOUND_DEPENDENT_OBJECTS_RESPONSE`

**URL**

`/domains/{ref}`

**Method**

`DELETE`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| ref |  path | string | Resource reference|

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method removes a Domain resource.

**Sample Call**

```json
DELETE /api/v1beta1/domains/dm6c87r2
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```
