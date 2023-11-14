This method gets a token for subsequent API calls.

**URL**

  `/token`

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
GET /api/{apiversion}/token
{

}

HTTP/1.1 200 OK
{
  "status": 200,
  "message": "Successful request",
  "data": "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiJ9.TZZ4kp5xIdYzs5RRt6_qVxJcOiLdk1IEHFMBSZ7SRENx6kyVhwfAlm-oeM4L2XFIr4evlTCxKEIKc0fZKwPcjw"
}
```

**Notes**

You must send a basic authentication header with this request.
