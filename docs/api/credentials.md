# Credentials

Gets a token for subsequent API calls

**URL**

  `/credentials`

**Method**

  `GET`

**URL Params**

  None

**Data Params**

  None

**Success Response**

| Code | Content|
| ---  |:------ |
| 200 OK  | JWT Token |

**Error Response**

| Code | Content   |
| ---  | :--------- |
| 401 UNAUTHORIZED | `{ status: "401", message : "You are unauthorized to make this request." }`|

**Sample Call**

```json
GET /api/{apiversion}/credentials
{

}

HTTP/1.1 200 OK
"eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiJ9.O7hC-ta225epRQlJZO44WC-l2cWohKnJ8lkmlOQpw8Z_xYiwJ6-qDUhHeJEZH9DmwIwz_jD77sj1kQUkXHsbOg"
```

**Notes**

You must send a basic authentication header with this request
