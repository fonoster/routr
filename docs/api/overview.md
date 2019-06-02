Routr API version is currently `v1beta1`. We continue to improve the API, resource definition, and other artifacts until we reach a final version. We can then establish an update policy to ensure backward compatibility. Until then keep an eye on this document.

The endpoint for the API is:

`/api/{apiversion}`

## Authentication

Routr's API is authenticated with a JWT token. To obtain the token use the
`/api/{apiversion}/credentials` endpoint with basic authentication. Use the information
from the [User](/configuration/user) resource.

> You must append the `token` to all requests as a query parameter.

**Sample call**

To obtain the token

```bash
curl -k -u "admin:changeit" https://localhost:4567/api/v1beta1/credentials

# Resulted in
eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiJ9.O7hC-ta225epRQlJZO44WC-l2cWohKnJ8lkmlOQpw8Z_xYiwJ6-qDUhHeJEZH9DmwIwz_jD77sj1kQUkXHsbOg
```

To use the token

```bash
curl -k -u "admin:changeit" https://localhost:4567/api/v1beta1/location?token=eyJhbGciOiJIUzUxMiJ9.e...

# Resulted in
{  
   "status":200,
   "message":"Successful request",
   "result":[  
      {  
         "addressOfRecord":"sip:1001@sip.local",
         "contactInfo":"sip:45962087@192.168.1.127:61147;transport=tcp;nat=false;expires=600"
      }
   ]
}
```

## Error Responses

The following are general errors we might have to account for:

| Code | Content   |
| ---  | :--------- |
| 400 BAD_REQUEST | `{ status: "400", message : "Bad Request" }`|
| 401 UNAUTHORIZED | `{ status: "401", message : "You are unauthorized to make this request." }`|
| 405 NOT_SUPPORTED | `{ status: "405", message : "Operation not supported by data source provider" }`|
| 409 CONFLICT | `{ status: "409", message : "An attempt was made to create an object that already exists" }`|
| 4091 UNFULFILLED_DEPENDENCY_RESPONSE | `{ status: "4091", message : "Found one or more unfulfilled dependencies" }`|
