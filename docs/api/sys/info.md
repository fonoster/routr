This method returns information about the server.

**URL**

`/system/info`

**Method**

`GET`

**Parameters**

This method does not receive any parameters.

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns relevant information about the server.

**Sample Call**

```json
GET /api/{apiversion}/system/info
{

}

HTTP/1.1 200 OK
{
  "status":200,
  "message":"Successful request",
  "data":{
    "version":"v1.0",
    "apiVersion":"v1beta1",
    "apiPath":"/api/v1beta1",
    "env":[
       {
         "var":"JAVA_OPTS",
         "value":null
       },
       {
         "var":"DATA_SOURCE_PROVIDER",
         "value":null
       },
       {
         "var":"DATA_SOURCE_PARAMETERS",
         "value":null
       },
       {
         "var":"CONFIG_FILE",
         "value":null
       },
       {
         "var":"EXTERN_ADDR",
         "value":null
       },
       {
         "var":"LOCALNETS",
         "value":null
       },
       {
         "var":"REGISTRAR_INTF",
         "value":null
       }
    ]
  }
}
```
