## create

Creates a new Agent resource. The Domain must exist before creating the Agent. Otherwise, this method responds with a `UNFULFILLED_DEPENDENCY_RESPONSE`.

**URL**

`/agents`

**Method**

`POST`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing an [Agent](/configuration/agents) resource in `json` or `yaml` format.

**Response**

If successful this method creates an Agent resource.

**Sample Call**

```json
POST /api/{apiversion}/agents
- apiVersion: v1beta1
  kind: Agent
  metadata:
    name: John Doe
  spec:
    credentials:
      username: '1001'
      secret: '1234'
    domains: [sip.local]

HTTP/1.1 201 Created
{"status": "201", "Successful request"}
```

## delete

Removes an Agent resource from a persistent database.

**URL**

`/agents`

**Method**

`DELETE`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| id |  path | string | Resource identifier|

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method removes an Agent resource.

**Sample Call**

```json
DELETE /api/{apiversion}/agents/{id}
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```

## get

This method returns an Agent resource.

**URL**

`/agents`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| id |  path | string | Resource identifier|


**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns an Agent resource.

**Sample Call**

```json
GET /api/{apiversion}/agents/{id}
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```

## list

This method returns a list of Agent resources.

**URL**

`/agents`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| filter |  query | string | Use filter to narrow the elements shown. |

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns a list of Agent resources.

**Sample Call**

```json
GET /api/{apiversion}/agents
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```

## update

Updates am existing Agent resource.

**URL**

`/agents`

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
PUT /api/{apiversion}/agents/{id}
- apiVersion: v1beta1
  kind: Agent
  metadata:
    name: John Doe
    ref: {id}
  spec:
    credentials:
      username: '1001'
      secret: '1234'
    domains: [sip.local]

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```
