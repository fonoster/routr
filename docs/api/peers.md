## create

Creates a new Peer resource.

**URL**

`/peers`

**Method**

`POST`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing an [Peer](/configuration/peer) resource in `json` or `yaml` format.

**Response**

If successful this method creates a Peer resource.

**Sample Call**

```json
POST /api/{apiversion}/peers
- apiVersion: v1beta1
  kind: Peer
  metadata:
    name: Asterisk PBX
  spec:
    credentials:
      username: ast
      secret: '1234'

HTTP/1.1 201 Created
{"status": "201", "Successful request"}
```

## delete

Removes a Peer resource from a persistent database.

**URL**

`/peers`

**Method**

`DELETE`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| id |  path | string | Resource identifier|

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method removes a Peer resource.

**Sample Call**

```json
DELETE /api/{apiversion}/peers/{id}
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```

## get

This method returns a Peer resource.

**URL**

`/peers`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| id |  path | string | Resource identifier|


**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns a Peer resource.

**Sample Call**

```json
GET /api/{apiversion}/peers/{id}
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```

## list

This method returns a list of Peer resources.

**URL**

`/peers`

**Method**

`GET`

**Parameters**

| Parameter Name | Type   | Value | Description
| ---  | :--------- |  :--------- |  :--------- |
| filter |  query | string | Use filter to narrow the elements shown. |

**Request body**

Do not supply a request body with this method.

**Response**

If successful this method returns a list of Peer resources.

**Sample Call**

```json
GET /api/{apiversion}/peers
{

}

HTTP/1.1 200 OK
{"status": "200", "Successful request"}
```

## update

Updates am existing Peer resource.

**URL**

`/peer`

**Method**

`PUT`

**Parameters**

This method does not receive any parameters.

**Request body**

A file containing a [Peer](/configuration/peers) resource in `json` or `yaml` format.

**Response**

If successful this method updates a Peer resource.

**Sample Call**

```json
PUT /api/{apiversion}/peers/{id}
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
