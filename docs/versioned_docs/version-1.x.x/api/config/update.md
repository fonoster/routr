# updateConfiguration

This method updates the servers' configuration.

**URL**

`/system/config`

**Method**

`PUT`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing the [servers' configuration](../../configuration/general.md) in `json` format.

**Response**

The changes will take effect on the next time the instance restart.

**Sample Call**

```json
PUT /api/{apiversion}/config
{
  "apiVersion": "v1beta1",
  "spec": {
    "dataSource": {
      "provider": "redis_data_provider"
    }
  }
}

HTTP/1.1 200 OK
{
  "status": "200",
  "message": "Successful request"
}
```
