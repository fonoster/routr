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
GET /api/v1beta1/system/info
{

}

HTTP/1.1 200 OK
{  
   "version":"v1.0",
   "apiVersion":"v1beta1",
   "apiPath":"/api/v1beta1",
   "env":[  
      {  
         "var":"ROUTR_JAVA_OPTS",
         "value":null
      },
      {  
         "var":"ROUTR_DS_PROVIDER",
         "value":null
      },
      {  
         "var":"ROUTR_DS_PARAMETERS",
         "value":null
      },
      {  
         "var":"ROUTR_CONFIG_PATH",
         "value":null
      },
      {  
         "var":"ROUTR_SALT",
         "value":null
      },
      {  
         "var":"ROUTR_EXTERN_ADDR",
         "value":null
      },
      {  
         "var":"ROUTR_LOCALNETS",
         "value":null
      },
      {  
         "var":"ROUTR_REGISTRAR_INTF",
         "value":null
      },
      {  
         "var":"ROUTR_JS_ENGINE",
         "value":null
      }
   ]
}
```
