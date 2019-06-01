Updates am existing Agent resource.

**URL**

`/agents/{ref}`

**Method**

`PUT`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing an [Agent](/configuration/agents) resource in `json` or `yaml` format.

**Response**

If successful this method updates an Agent resource.

**Sample Call**

```json
PUT /api/{apiversion}/agents/{ref}
- apiVersion: v1beta1
  kind: Agent
  metadata:
    name: John Doe
    ref: {ref}
  spec:
    credentials:
      username: '1001'
      secret: '1234'
    domains: [sip.local]

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```
