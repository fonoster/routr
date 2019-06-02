This method gets a token for subsequent API calls.

**URL**

  `/credentials`

**Method**

  `GET`

**Parameters**

  This method does not receive any parameters.

**Request body**

  Do not supply a request body with this method.

**Response**

  If successful, this method returns a string with a token.

**Sample Call**

```json
GET /api/{apiversion}/credentials
{

}

HTTP/1.1 200 OK
"eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiJ9.O7hC-ta225epRQlJZO44WC-l2cWohKnJ8lkmlOQpw8Z_xYiwJ6-qDUhHeJEZH9DmwIwz_jD77sj1kQUkXHsbOg"
```

**Notes**

You must send a basic authentication header with this request.
