## Introduction

**Routr** API version is currently `v1beta1`. We continue to improve the API, resource definition, and other artifacts until we reach a final version. We can then establish an update policy to ensure backward compatibility. Until then keep an eye on this document. The endpoint for the API is as follows:

`/api/{apiversion}`

## Authentication

Obtain your API by 
`/api/{apiversion}/credentials`

`/api/{apiversion}`


---

## Obtain Account Key
Obtain API access key

### Arguments:

username :: string : User name
secret :: string : Password

### Result:
res :: integer : Status code (0 on success, 1 otherwise)

### Examples:
```javascript
    POST /api/{apiversion}/credentials
    {
      "user": "peter",
      "host": "myserver.com",
      "newpass": "blank"
    }
    
    HTTP/1.1 200 OK
    ""
```
