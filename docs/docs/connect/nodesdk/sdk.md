# SDK

<!-- toc -->
* [Installation](#installation)
* [APIs](#apis)
<!-- tocstop -->
# Installation
<!-- installation -->
```sh-session
$ npm install --save @routr/sdk
```
<!-- usagestop -->
# APIs
<!-- apis -->
* [`Access Control List`](#ACL)
* [`Agents`](#Agents)
* [`Credentials`](#Credentials)
* [`Domains`](#Domains)
* [`Numbers`](#Numbers)
* [`Peers`](#Peers)
* [`Trunks`](#Trunks)


<a name="ACL"></a>

## ACL ⇐ <code>APIClient</code>
Use Routr ACL, a capability of Routr SIP Proxy, to create, update, get
and delete Access Control Lists. The ACL API requires of a running Routr deployment.

**Kind**: global class  
**Extends**: <code>APIClient</code>  
**See**: module:core:APIClient  

* [ACL](#ACL) ⇐ <code>APIClient</code>
    * [new ACL(options)](#new_ACL_new)
    * [.createACL(request)](#ACL+createACL) ⇒ <code>Promise.&lt;CreateACLResponse&gt;</code>
    * [.updateACL(request)](#ACL+updateACL) ⇒ <code>Promise.&lt;UpdateACLResponse&gt;</code>
    * [.getACL(ref)](#ACL+getACL) ⇒ <code>Promise.&lt;GetACLResponse&gt;</code>
    * [.deleteACL(ref)](#ACL+deleteACL) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.listACLs(request)](#ACL+listACLs) ⇒ <code>Promise.&lt;ListACLResponse&gt;</code>

<a name="new_ACL_new"></a>

### new ACL(options)
Constructs a new ACL API object.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>ClientOptions</code> | Options to indicate the objects endpoint |

**Example**  
```js
const SDK = require("@routr/sdk")
const acl = new SDK.ACL()

const request = {
  name: "Peer network",
  allow: "27.116.56.0/22",
  deny: "0.0.0.0/0"
}

acl.createACL(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="ACL+createACL"></a>

### acL.createACL(request) ⇒ <code>Promise.&lt;CreateACLResponse&gt;</code>
Creates a new AccessControlList on Routr.

**Kind**: instance method of [<code>ACL</code>](#ACL)  
**Returns**: <code>Promise.&lt;CreateACLResponse&gt;</code> - The newly created AccessControlList  
**Throws**:

- if request is null


| Param | Type | Description |
| --- | --- | --- |
| request | <code>CreateACLRequest</code> | The request to create an ACL |
| request.name | <code>string</code> | Name of the ACL |
| request.allow | <code>Array.&lt;string&gt;</code> | List of IP addresses or CIDR blocks to allow |
| request.deny | <code>Array.&lt;string&gt;</code> | List of IP addresses or CIDR blocks to deny |
| request.extended | <code>Object</code> | Optional extended attributes |

**Example**  
```js
const request = {
  name: "Peer network",
  allow: "27.116.56.0/22",
  deny: "0.0.0.0/0"
}

acl.createACL(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="ACL+updateACL"></a>

### acL.updateACL(request) ⇒ <code>Promise.&lt;UpdateACLResponse&gt;</code>
Updates an already existing AccessControlList on Routr.

**Kind**: instance method of [<code>ACL</code>](#ACL)  
**Returns**: <code>Promise.&lt;UpdateACLResponse&gt;</code> - The AccessControlList  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>UpdateACLRequest</code> | Partial with the fields to update |
| request.name | <code>string</code> | Name of the ACL |
| request.allow | <code>Array.&lt;string&gt;</code> | List of IP addresses or CIDR blocks to allow |
| request.deny | <code>Array.&lt;string&gt;</code> | List of IP addresses or CIDR blocks to deny |
| request.extended | <code>Object</code> | Optional extended attributes |

**Example**  
```js
const request = {
  ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  name: "Peer network updated",
}

acl.updateACL(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="ACL+getACL"></a>

### acL.getACL(ref) ⇒ <code>Promise.&lt;GetACLResponse&gt;</code>
Gets an AccessControlList from Routr.

**Kind**: instance method of [<code>ACL</code>](#ACL)  
**Returns**: <code>Promise.&lt;GetACLResponse&gt;</code> - The AccessControlList  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The ACL reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

acl.getACL(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="ACL+deleteACL"></a>

### acL.deleteACL(ref) ⇒ <code>Promise.&lt;void&gt;</code>
Deletes an AccessControlList from Routr.

**Kind**: instance method of [<code>ACL</code>](#ACL)  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The ACL reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

acl.deleteACL(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="ACL+listACLs"></a>

### acL.listACLs(request) ⇒ <code>Promise.&lt;ListACLResponse&gt;</code>
Lists all AccessControlLists from Routr with pagination.

**Kind**: instance method of [<code>ACL</code>](#ACL)  
**Returns**: <code>Promise.&lt;ListACLResponse&gt;</code> - The list of AccessControlLists  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>ListACLRequest</code> | The request to list ACLs |
| request.pageSize | <code>number</code> | The number of ACLs to return |
| request.pageToken | <code>string</code> | The page token to use for pagination |

**Example**  
```js
const request = {
 pageSize: 10
}

acl.listACLs(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```

<a name="Agents"></a>

## Agents ⇐ <code>APIClient</code>
Use Routr Agents, a capability of Routr SIP Proxy, to create, update, get
and delete Agents. The Agents API requires of a running Routr deployment.

**Kind**: global class  
**Extends**: <code>APIClient</code>  
**See**: module:core:APIClient  

* [Agents](#Agents) ⇐ <code>APIClient</code>
    * [new Agents(options)](#new_Agents_new)
    * [.createAgent(request)](#Agents+createAgent) ⇒ <code>Promise.&lt;CreateAgentResponse&gt;</code>
    * [.updateAgent(request)](#Agents+updateAgent) ⇒ <code>Promise.&lt;UpdateAgentResponse&gt;</code>
    * [.getAgent(ref)](#Agents+getAgent) ⇒ <code>Promise.&lt;GetAgentResponse&gt;</code>
    * [.deleteAgent(ref)](#Agents+deleteAgent) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.listAgents(request)](#Agents+listAgents) ⇒ <code>Promise.&lt;ListAgentResponse&gt;</code>

<a name="new_Agents_new"></a>

### new Agents(options)
Constructs a new Agent API object.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>ClientOptions</code> | Options to indicate the objects endpoint |

**Example**  
```js
const SDK = require("@routr/sdk")
const agents = new SDK.Agents()

const request = {
  name: "Jonh Doe",
  username: "jdoe",
  privacy: Privacy.PRIVATE,
  domainRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  credentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  enabled: true,
  extended: {
    "key": "value"
  }
}

agents.createAgent(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Agents+createAgent"></a>

### agents.createAgent(request) ⇒ <code>Promise.&lt;CreateAgentResponse&gt;</code>
Creates a new Agent on Routr.

**Kind**: instance method of [<code>Agents</code>](#Agents)  
**Returns**: <code>Promise.&lt;CreateAgentResponse&gt;</code> - The newly created Agent  
**Throws**:

- if request is null


| Param | Type | Description |
| --- | --- | --- |
| request | <code>CreateAgentRequest</code> | The request to create an Agent |
| request.name | <code>string</code> | Name of the Agent |
| request.username | <code>string</code> | Username of the Agent |
| request.privacy | <code>Privacy</code> | Privacy of the Agent (e.g., Privacy.PRIVATE) |
| request.domainRef | <code>string</code> | Domain reference of the Domain the Agent belongs to |
| request.credentialsRef | <code>string</code> | Credentials reference of the Credentials for the Agent |
| request.enabled | <code>boolean</code> | Whether the Agent is enabled or not (for future use) |
| request.extended | <code>Object</code> | Optional extended attributes |

**Example**  
```js
const request = {
  name: "Jonh Doe",
  username: "jdoe",
  privacy: Privacy.PRIVATE,
  domainRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  credentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  enabled: true,
  extended: {
    "key": "value"
  }
}

agents.createAgent(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Agents+updateAgent"></a>

### agents.updateAgent(request) ⇒ <code>Promise.&lt;UpdateAgentResponse&gt;</code>
Updates an already existing Agent on Routr.

**Kind**: instance method of [<code>Agents</code>](#Agents)  
**Returns**: <code>Promise.&lt;UpdateAgentResponse&gt;</code> - The updated Agent  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>UpdateAgentRequest</code> | Partial with the fields to update |
| request.name | <code>string</code> | Name of the Agent |
| request.privacy | <code>Privacy</code> | Privacy of the Agent (e.g., Privacy.PRIVATE) |
| request.domainRef | <code>string</code> | Domain reference of the Domain the Agent belongs to |
| request.credentialsRef | <code>string</code> | Credentials reference of the Credentials for the Agent |
| request.enabled | <code>boolean</code> | Whether the Agent is enabled or not (for future use) |
| request.extended | <code>Object</code> | Optional extended attributes |

**Example**  
```js
const request = {
  ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  name: "John D Doe",
  enabled: false
}

agents.updateAgent(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Agents+getAgent"></a>

### agents.getAgent(ref) ⇒ <code>Promise.&lt;GetAgentResponse&gt;</code>
Gets an Agent from Routr.

**Kind**: instance method of [<code>Agents</code>](#Agents)  
**Returns**: <code>Promise.&lt;GetAgentResponse&gt;</code> - The Agent  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Agent's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

agents.getAgent(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Agents+deleteAgent"></a>

### agents.deleteAgent(ref) ⇒ <code>Promise.&lt;void&gt;</code>
Deletes an Agent from Routr.

**Kind**: instance method of [<code>Agents</code>](#Agents)  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Agent's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

agents.deleteAgent(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Agents+listAgents"></a>

### agents.listAgents(request) ⇒ <code>Promise.&lt;ListAgentResponse&gt;</code>
Lists all Agents from Routr with pagination.

**Kind**: instance method of [<code>Agents</code>](#Agents)  
**Returns**: <code>Promise.&lt;ListAgentResponse&gt;</code> - The list of Agents in the current page  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>ListAgentRequest</code> | The request to list Agents |
| request.pageSize | <code>number</code> | The number of Agents to return |
| request.pageToken | <code>string</code> | The page token to use for pagination |

**Example**  
```js
const request = {
 pageSize: 10
}

agents.listAgents(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```

<a name="Credentials"></a>

## Credentials ⇐ <code>APIClient</code>
Use Routr Credentials, a capability of Routr SIP Proxy, to create, update, get
and delete Credentials. The Credentials API requires of a running Routr deployment.

**Kind**: global class  
**Extends**: <code>APIClient</code>  
**See**: module:core:APIClient  

* [Credentials](#Credentials) ⇐ <code>APIClient</code>
    * [new Credentials(options)](#new_Credentials_new)
    * [.createCredentials(request)](#Credentials+createCredentials) ⇒ <code>Promise.&lt;CreateCredentialsResponse&gt;</code>
    * [.updateCredentials(request)](#Credentials+updateCredentials) ⇒ <code>Promise.&lt;UpdateCredentialsResponse&gt;</code>
    * [.getCredentials(ref)](#Credentials+getCredentials) ⇒ <code>Promise.&lt;GetCredentialsResponse&gt;</code>
    * [.deleteCredentials(ref)](#Credentials+deleteCredentials) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.listCredentials(request)](#Credentials+listCredentials) ⇒ <code>Promise.&lt;ListCredentialsResponse&gt;</code>

<a name="new_Credentials_new"></a>

### new Credentials(options)
Constructs a new Credentials API object.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>ClientOptions</code> | Options to indicate the objects endpoint |

**Example**  
```js
const SDK = require("@routr/sdk")
const credentials = new SDK.Credentials()

const request = {
  name: "Credentials for John Doe",
  username: "jdoe",
  password: "123456",
  extended: {
    "key": "value"
  }
}

credentials.createCredentials(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Credentials+createCredentials"></a>

### credentials.createCredentials(request) ⇒ <code>Promise.&lt;CreateCredentialsResponse&gt;</code>
Creates a new Credentials on Routr.

**Kind**: instance method of [<code>Credentials</code>](#Credentials)  
**Returns**: <code>Promise.&lt;CreateCredentialsResponse&gt;</code> - The newly created Credentials  
**Throws**:

- if request is null


| Param | Type | Description |
| --- | --- | --- |
| request | <code>CreateCredentialsRequest</code> | The request to create an Credentials |
| request.name | <code>string</code> | The friendly name of the Credentials |
| request.username | <code>string</code> | Username of the Credentials |
| request.password | <code>string</code> | Password of the Credentials |
| request.extended | <code>Object</code> | Optional extended attributes |

**Example**  
```js
const request = {
  name: "Credentials for John Doe",
  username: "jdoe",
  password: "123456",
  extended: {
    "key": "value"
  }
}

credentials.createCredentials(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Credentials+updateCredentials"></a>

### credentials.updateCredentials(request) ⇒ <code>Promise.&lt;UpdateCredentialsResponse&gt;</code>
Updates an already existing Credentials on Routr.

**Kind**: instance method of [<code>Credentials</code>](#Credentials)  
**Returns**: <code>Promise.&lt;UpdateCredentialsResponse&gt;</code> - The updated Credentials  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>UpdateCredentialsRequest</code> | Partial with the fields to update |
| request.name | <code>string</code> | The friendly name of the Credentials |
| request.username | <code>string</code> | Username of the Credentials |
| request.password | <code>string</code> | Password of the Credentials |
| request.extended | <code>Object</code> | Optional extended attributes |

**Example**  
```js
const request = {
  ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  name: "John Doe's Credentials"
}

credentials.updateCredentials(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Credentials+getCredentials"></a>

### credentials.getCredentials(ref) ⇒ <code>Promise.&lt;GetCredentialsResponse&gt;</code>
Gets an Credentials from Routr.

**Kind**: instance method of [<code>Credentials</code>](#Credentials)  
**Returns**: <code>Promise.&lt;GetCredentialsResponse&gt;</code> - The Credentials  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Credentials's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

credentials.getCredentials(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Credentials+deleteCredentials"></a>

### credentials.deleteCredentials(ref) ⇒ <code>Promise.&lt;void&gt;</code>
Deletes an Credentials from Routr.

**Kind**: instance method of [<code>Credentials</code>](#Credentials)  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Credentials's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

credentials.deleteCredentials(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Credentials+listCredentials"></a>

### credentials.listCredentials(request) ⇒ <code>Promise.&lt;ListCredentialsResponse&gt;</code>
Lists all Credentials from Routr with pagination.

**Kind**: instance method of [<code>Credentials</code>](#Credentials)  
**Returns**: <code>Promise.&lt;ListCredentialsResponse&gt;</code> - The list of Credentials in the current page  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>ListCredentialsRequest</code> | The request to list Credentials |
| request.pageSize | <code>number</code> | The number of Credentials to return |
| request.pageToken | <code>string</code> | The page token to use for pagination |

**Example**  
```js
const request = {
 pageSize: 10
}

credentials.listCredentials(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```

<a name="Domains"></a>

## Domains ⇐ <code>APIClient</code>
Use Routr Domains, a capability of Routr SIP Proxy, to create, update, get
and delete Domains. The Domains API requires of a running Routr deployment.

**Kind**: global class  
**Extends**: <code>APIClient</code>  
**See**: module:core:APIClient  

* [Domains](#Domains) ⇐ <code>APIClient</code>
    * [new Domains(options)](#new_Domains_new)
    * [.createDomain(request)](#Domains+createDomain) ⇒ <code>Promise.&lt;CreateDomainResponse&gt;</code>
    * [.updateDomain(request)](#Domains+updateDomain) ⇒ <code>Promise.&lt;UpdateDomainResponse&gt;</code>
    * [.getDomain(ref)](#Domains+getDomain) ⇒ <code>Promise.&lt;GetDomainResponse&gt;</code>
    * [.deleteDomain(ref)](#Domains+deleteDomain) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.listDomains(request)](#Domains+listDomains) ⇒ <code>Promise.&lt;ListDomainResponse&gt;</code>

<a name="new_Domains_new"></a>

### new Domains(options)
Constructs a new Domain API object.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>ClientOptions</code> | Options to indicate the objects endpoint |

**Example**  
```js
const SDK = require("@routr/sdk")
const domains = new SDK.Domains()

const request = {
  name: "Local domain",
  domainUri: "sip.local",
  accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  egressPolicies: [{
    rule: ".*",
    numberRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
  }],
  extended: {
    "key": "value"
  }
}

domains.createDomain(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Domains+createDomain"></a>

### domains.createDomain(request) ⇒ <code>Promise.&lt;CreateDomainResponse&gt;</code>
Creates a new Domain on Routr.

**Kind**: instance method of [<code>Domains</code>](#Domains)  
**Returns**: <code>Promise.&lt;CreateDomainResponse&gt;</code> - The newly created Domain  
**Throws**:

- if request is null


| Param | Type | Description |
| --- | --- | --- |
| request | <code>CreateDomainRequest</code> | The request to create an Domain |
| request.name | <code>string</code> | Name of the Domain |
| request.domainUri | <code>string</code> | The FQDN of the Domain |
| request.accessControlListRef | <code>string</code> | The reference to the AccessControlList for the Domain |
| request.egressPolicies | <code>Array.&lt;CC.EgressPolicy&gt;</code> | The list of EgressPolicies for the Domain |
| request.extended | <code>string</code> | Optional extended attributes |

**Example**  
```js
const request = {
  name: "Local domain",
  domainUri: "sip.local",
  accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  egressPolicies: [{
    rule: ".*",
    numberRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
  }],
  extended: {
    "key": "value"
  }
}

domains.createDomain(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Domains+updateDomain"></a>

### domains.updateDomain(request) ⇒ <code>Promise.&lt;UpdateDomainResponse&gt;</code>
Updates an already existing Domain on Routr.

**Kind**: instance method of [<code>Domains</code>](#Domains)  
**Returns**: <code>Promise.&lt;UpdateDomainResponse&gt;</code> - The updated Domain  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>UpdateDomainRequest</code> | Partial with the fields to update |
| request.name | <code>string</code> | Name of the Domain |
| request.accessControlListRef | <code>string</code> | The reference to the AccessControlList for the Domain |
| request.egressPolicies | <code>Array.&lt;CC.EgressPolicy&gt;</code> | The list of EgressPolicies for the Domain |
| request.extended | <code>string</code> | Optional extended attributes |

**Example**  
```js
const request = {
  name: "Local domain updated",
  accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
}

domains.updateDomain(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Domains+getDomain"></a>

### domains.getDomain(ref) ⇒ <code>Promise.&lt;GetDomainResponse&gt;</code>
Gets a Domain from Routr.

**Kind**: instance method of [<code>Domains</code>](#Domains)  
**Returns**: <code>Promise.&lt;GetDomainResponse&gt;</code> - The Domain  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Domain's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

domains.getDomain(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Domains+deleteDomain"></a>

### domains.deleteDomain(ref) ⇒ <code>Promise.&lt;void&gt;</code>
Deletes a Domain from Routr.

**Kind**: instance method of [<code>Domains</code>](#Domains)  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Domain's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

domains.deleteDomain(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Domains+listDomains"></a>

### domains.listDomains(request) ⇒ <code>Promise.&lt;ListDomainResponse&gt;</code>
Lists all Domains from Routr with pagination.

**Kind**: instance method of [<code>Domains</code>](#Domains)  
**Returns**: <code>Promise.&lt;ListDomainResponse&gt;</code> - The list of Domains  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>ListDomainRequest</code> | The request to list Domains |
| request.pageSize | <code>number</code> | The number of Domains to return |
| request.pageToken | <code>string</code> | The page token to use for pagination |

**Example**  
```js
const request = {
  pageSize: 10
}

domains.listDomains(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```

<a name="Numbers"></a>

## Numbers ⇐ <code>APIClient</code>
Use Routr Numbers, a capability of Routr SIP Proxy, to create, update, get
and delete Numbers. The Number API requires of a running Routr deployment.

**Kind**: global class  
**Extends**: <code>APIClient</code>  
**See**: module:core:APIClient  

* [Numbers](#Numbers) ⇐ <code>APIClient</code>
    * [new Numbers(options)](#new_Numbers_new)
    * [.createNumber(request)](#Numbers+createNumber) ⇒ <code>Promise.&lt;CreateNumberResponse&gt;</code>
    * [.updateNumber(request)](#Numbers+updateNumber) ⇒ <code>Promise.&lt;UpdateNumberResponse&gt;</code>
    * [.getNumber(ref)](#Numbers+getNumber) ⇒ <code>Promise.&lt;GetNumberResponse&gt;</code>
    * [.deleteNumber(ref)](#Numbers+deleteNumber) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.listNumbers(request)](#Numbers+listNumbers) ⇒ <code>Promise.&lt;ListNumberResponse&gt;</code>

<a name="new_Numbers_new"></a>

### new Numbers(options)
Constructs a new Number API object.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>ClientOptions</code> | Options to indicate the objects endpoint |

**Example**  
```js
const SDK = require("@routr/sdk")
const numbers = new SDK.Numbers()

const request = {
  name: "(415) 555-1212",
  telUrl: "teL:+14155551212",
  trunkRef: "6f941c63-880c-419a-a72a-4a107cbaf5c5",
  aorLink: "sip:100@sip.local",
  city: "San Francisco",
  country: "United States",
  countryISOCode: "US",
  sessionAffinityHeader: "X-Room-Id"
  extraHeaders: [{
    name: "X-Room-Id",
    value: "abc-us-123"
  }],
  extended: {
    "key": "value"
  }
}

numbers.createNumber(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Numbers+createNumber"></a>

### numbers.createNumber(request) ⇒ <code>Promise.&lt;CreateNumberResponse&gt;</code>
Creates a new Number on Routr.

**Kind**: instance method of [<code>Numbers</code>](#Numbers)  
**Returns**: <code>Promise.&lt;CreateNumberResponse&gt;</code> - The newly created Number  
**Throws**:

- if request is null


| Param | Type | Description |
| --- | --- | --- |
| request | <code>CreateNumberRequest</code> | The request to create an Number |
| request.name | <code>string</code> | Name of the Number |
| request.telUrl | <code>string</code> | The number URI to be used (e.g., te:+1234567890) |
| request.aorLink | <code>string</code> | The AOR link to be used (e.g., sip:1001@sip.local) |
| request.city | <code>string</code> | The city where the number is located |
| request.country | <code>string</code> | The country where the number is located |
| request.countryISOCode | <code>string</code> | The country ISO code where the number is located |
| request.extraHeaders | <code>Array.&lt;Object&gt;</code> | Extra headers to be used (e.g., [\{name: "X-Room-Id", value: "abc-us-123"\}]) |
| request.trunkRef | <code>string</code> | The Trunk reference to be used |
| request.sessionAffinityHeader | <code>string</code> | Optional session affinity header |
| request.extended | <code>string</code> | Optional extended attributes |

**Example**  
```js
const request = {
  name: "(415) 555-1212",
  telUrl: "teL:+14155551212",
  trunkRef: "6f941c63-880c-419a-a72a-4a107cbaf5c5",
  aorLink: "sip:100@sip.local",
  city: "San Francisco",
  country: "United States",
  countryISOCode: "US",
  sessionAffinityHeader: "X-Room-Id"
  extraHeaders: [{
    name: "X-Room-Id",
    value: "abc-us-123"
  }],
  extended: {
    "key": "value"
  }
}

numbers.createNumber(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Numbers+updateNumber"></a>

### numbers.updateNumber(request) ⇒ <code>Promise.&lt;UpdateNumberResponse&gt;</code>
Updates an already existing Number on Routr.

**Kind**: instance method of [<code>Numbers</code>](#Numbers)  
**Returns**: <code>Promise.&lt;UpdateNumberResponse&gt;</code> - The updated Number  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>UpdateNumberRequest</code> | Partial with the fields to update |
| request.name | <code>string</code> | Name of the Number |
| request.aorLink | <code>string</code> | The AOR link to be used (e.g., sip:1001@sip.local) |
| request.extraHeaders | <code>Array.&lt;Object&gt;</code> | Extra headers to be used (e.g., [\{name: "X-Room-Id", value: "abc-us-123"\}]) |
| request.trunkRef | <code>string</code> | The Trunk reference to be used |
| request.sessionAffinityHeader | <code>string</code> | Optional session affinity header |
| request.extended | <code>string</code> | Optional extended attributes |

**Example**  
```js
const request = {
  name: "(415) 555-1212 (friendly name)",
  aorLink: "sip:2001@sip.local"
}

numbers.updateNumber(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Numbers+getNumber"></a>

### numbers.getNumber(ref) ⇒ <code>Promise.&lt;GetNumberResponse&gt;</code>
Gets a Number from Routr.

**Kind**: instance method of [<code>Numbers</code>](#Numbers)  
**Returns**: <code>Promise.&lt;GetNumberResponse&gt;</code> - The Number  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Number's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

numbers.getNumber(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Numbers+deleteNumber"></a>

### numbers.deleteNumber(ref) ⇒ <code>Promise.&lt;void&gt;</code>
Deletes a Number from Routr.

**Kind**: instance method of [<code>Numbers</code>](#Numbers)  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Number's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

numbers.deleteNumber(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Numbers+listNumbers"></a>

### numbers.listNumbers(request) ⇒ <code>Promise.&lt;ListNumberResponse&gt;</code>
Lists all Numbers from Routr with pagination.

**Kind**: instance method of [<code>Numbers</code>](#Numbers)  
**Returns**: <code>Promise.&lt;ListNumberResponse&gt;</code> - The list of Numbers  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>ListNumberRequest</code> | The request to list Numbers |
| request.pageSize | <code>number</code> | The number of Numbers to return |
| request.pageToken | <code>string</code> | The page token to use for pagination |

**Example**  
```js
const request = {
 pageSize: 10
}

numbers.listNumbers(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```

<a name="Peers"></a>

## Peers ⇐ <code>APIClient</code>
Use Routr Peers, a capability of Routr SIP Proxy, to create, update, get
and delete Peers. The Peers API requires of a running Routr deployment.

**Kind**: global class  
**Extends**: <code>APIClient</code>  
**See**: module:core:APIClient  

* [Peers](#Peers) ⇐ <code>APIClient</code>
    * [new Peers(options)](#new_Peers_new)
    * [.createPeer(request)](#Peers+createPeer) ⇒ <code>Promise.&lt;CreatePeerResponse&gt;</code>
    * [.updatePeer(request)](#Peers+updatePeer) ⇒ <code>Promise.&lt;UpdatePeerResponse&gt;</code>
    * [.getPeer(ref)](#Peers+getPeer) ⇒ <code>Promise.&lt;GetPeerResponse&gt;</code>
    * [.deletePeer(ref)](#Peers+deletePeer) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.listPeers(request)](#Peers+listPeers) ⇒ <code>Promise.&lt;ListPeerResponse&gt;</code>

<a name="new_Peers_new"></a>

### new Peers(options)
Constructs a new Peer API object.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>ClientOptions</code> | Options to indicate the objects endpoint |

**Example**  
```js
const SDK = require("@routr/sdk")
const peers = new SDK.Peers()

const request = {
  name: "Asterisk Conference Server",
  username: "conference",
  aor: "sip:conference@sip.local",
  contactAddr: "10.0.0.1:5060",
  accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  credentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  balancingAlgorithm: LoadBalancingAlgorithm.LEAST_SESSIONS,
  withSessionAffinity: true,
  enabled: true,
  extended: {
    "key": "value"
  }
}

peers.createPeer(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Peers+createPeer"></a>

### peers.createPeer(request) ⇒ <code>Promise.&lt;CreatePeerResponse&gt;</code>
Creates a new Peer on Routr.

**Kind**: instance method of [<code>Peers</code>](#Peers)  
**Returns**: <code>Promise.&lt;CreatePeerResponse&gt;</code> - The newly created Peer  
**Throws**:

- if request is null


| Param | Type | Description |
| --- | --- | --- |
| request | <code>CreatePeerRequest</code> | The request to create an Peer |
| request.name | <code>string</code> | Name of the Peer |
| request.aor | <code>string</code> | Address of Record of the Peer |
| request.contactAddr | <code>string</code> | Optional contact address of the Peer |
| request.accessControlListRef | <code>string</code> | Access Control List reference of the Peer |
| request.credentialsRef | <code>string</code> | Credentials reference of the Credentials for the Peer |
| request.balancingAlgorithm | <code>LoadBalancingAlgorithm</code> | Optional balancing algorithm for the Peer (defaults to "round-robin") |
| request.withSessionAffinity | <code>boolean</code> | Whether the Peer has session affinity or not (defaults to false) |
| request.enabled | <code>boolean</code> | Whether the Peer is enabled or not (for future use) |
| request.extended | <code>Object</code> | Optional extended attributes |

**Example**  
```js
const request = {
  name: "Asterisk Conference Server",
  username: "conference",
  aor: "sip:conference@sip.local",
  contactAddr: "10.0.0.1:5060",
  accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  credentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  balancingAlgorithm: LoadBalancingAlgorithm.LEAST_SESSIONS,
  withSessionAffinity: true,
  enabled: true,
  extended: {
    "key": "value"
  }
}

peers.createPeer(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Peers+updatePeer"></a>

### peers.updatePeer(request) ⇒ <code>Promise.&lt;UpdatePeerResponse&gt;</code>
Updates an already existing Peer on Routr.

**Kind**: instance method of [<code>Peers</code>](#Peers)  
**Returns**: <code>Promise.&lt;UpdatePeerResponse&gt;</code> - The updated Peer  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>UpdatePeerRequest</code> | Partial with the fields to update |
| request.name | <code>string</code> | Name of the Peer |
| request.aor | <code>string</code> | Address of Record of the Peer |
| request.contactAddr | <code>string</code> | Optional contact address of the Peer |
| request.accessControlListRef | <code>string</code> | Access Control List reference of the Peer |
| request.credentialsRef | <code>string</code> | Credentials reference of the Credentials for the Peer |
| request.balancingAlgorithm | <code>LoadBalancingAlgorithm</code> | Optional balancing algorithm for the Peer (defaults to "round-robin") |
| request.withSessionAffinity | <code>boolean</code> | Whether the Peer has session affinity or not (defaults to false) |
| request.enabled | <code>boolean</code> | Whether the Peer is enabled or not (for future use) |
| request.extended | <code>Object</code> | Optional extended attributes |

**Example**  
```js
const request = {
  ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  name: "Feature Server"
}

peers.updatePeer(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Peers+getPeer"></a>

### peers.getPeer(ref) ⇒ <code>Promise.&lt;GetPeerResponse&gt;</code>
Gets an Peer from Routr.

**Kind**: instance method of [<code>Peers</code>](#Peers)  
**Returns**: <code>Promise.&lt;GetPeerResponse&gt;</code> - The Peer  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Peer's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

peers.getPeer(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Peers+deletePeer"></a>

### peers.deletePeer(ref) ⇒ <code>Promise.&lt;void&gt;</code>
Deletes an Peer from Routr.

**Kind**: instance method of [<code>Peers</code>](#Peers)  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Peer's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

peers.deletePeer(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Peers+listPeers"></a>

### peers.listPeers(request) ⇒ <code>Promise.&lt;ListPeerResponse&gt;</code>
Lists all Peers from Routr with pagination.

**Kind**: instance method of [<code>Peers</code>](#Peers)  
**Returns**: <code>Promise.&lt;ListPeerResponse&gt;</code> - The list of Peers in the current page  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>ListPeerRequest</code> | The request to list Peers |
| request.pageSize | <code>number</code> | The number of Peers to return |
| request.pageToken | <code>string</code> | The page token to use for pagination |

**Example**  
```js
const request = {
 pageSize: 10
}

peers.listPeers(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```

<a name="Trunks"></a>

## Trunks ⇐ <code>APIClient</code>
Use Routr Trunks, a capability of Routr SIP Proxy, to create, update, get
and delete Trunks. The Trunks API requires of a running Routr deployment.

**Kind**: global class  
**Extends**: <code>APIClient</code>  
**See**: module:core:APIClient  

* [Trunks](#Trunks) ⇐ <code>APIClient</code>
    * [new Trunks(options)](#new_Trunks_new)
    * [.createTrunk(request)](#Trunks+createTrunk) ⇒ <code>Promise.&lt;CreateTrunkResponse&gt;</code>
    * [.updateTrunk(request)](#Trunks+updateTrunk) ⇒ <code>Promise.&lt;UpdateTrunkResponse&gt;</code>
    * [.getTrunk(ref)](#Trunks+getTrunk) ⇒ <code>Promise.&lt;GetTrunkResponse&gt;</code>
    * [.deleteTrunk(ref)](#Trunks+deleteTrunk) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.listTrunks(request)](#Trunks+listTrunks) ⇒ <code>Promise.&lt;ListTrunkResponse&gt;</code>

<a name="new_Trunks_new"></a>

### new Trunks(options)
Constructs a new Trunk API object.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>ClientOptions</code> | Options to indicate the objects endpoint |

**Example**  
```js
const SDK = require("@routr/sdk")
const trunks = new SDK.Trunks()

const request = {
  name: "Trunk from Twilio",
  inboundUri: "sip:twilio.sip.acme.io",
  accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  inboundCredentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  outboundCredentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  uris: [{
    host: "acme.sip.twilio.com",
    port: 5060,
    transport: "udp",
    user: "AC1234567890",
    weight: 1,
    priority: 1
  }],
  extended: {
    "key": "value"
  }
}

trunks.createTrunk(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Trunks+createTrunk"></a>

### trunks.createTrunk(request) ⇒ <code>Promise.&lt;CreateTrunkResponse&gt;</code>
Creates a new Trunk on Routr.

**Kind**: instance method of [<code>Trunks</code>](#Trunks)  
**Returns**: <code>Promise.&lt;CreateTrunkResponse&gt;</code> - The newly created Trunk  
**Throws**:

- if request is null


| Param | Type | Description |
| --- | --- | --- |
| request | <code>CreateTrunkRequest</code> | The request to create an Trunk |
| request.name | <code>string</code> | Name of the Trunk |
| request.inboundUri | <code>string</code> | Inbound URI of the Trunk |
| request.accessControlListRef | <code>string</code> | Access Control List reference |
| request.inboundCredentialsRef | <code>string</code> | The reference of the inbound credentials |
| request.outboundCredentialsRef | <code>string</code> | The reference of the outbound credentials |
| request.uris | <code>Array.&lt;TrunkURI&gt;</code> | The outbound URIs of the Trunk |

**Example**  
```js
const request = {
  name: "Trunk from Twilio",
  inboundUri: "sip:twilio.sip.acme.io",
  accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  inboundCredentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  outboundCredentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  uris: [{
    host: "acme.sip.twilio.com",
    port: 5060,
    transport: "udp",
    user: "AC1234567890",
    weight: 1,
    priority: 1
  }],
  extended: {
    "key": "value"
  }
}

trunks.createTrunk(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Trunks+updateTrunk"></a>

### trunks.updateTrunk(request) ⇒ <code>Promise.&lt;UpdateTrunkResponse&gt;</code>
Updates an already existing Trunk on Routr.

**Kind**: instance method of [<code>Trunks</code>](#Trunks)  
**Returns**: <code>Promise.&lt;UpdateTrunkResponse&gt;</code> - The updated Trunk  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>UpdateTrunkRequest</code> | Partial with the fields to update |
| request.name | <code>string</code> | Name of the Trunk |
| request.inboundUri | <code>string</code> | Inbound URI of the Trunk |
| request.accessControlListRef | <code>string</code> | Access Control List reference |
| request.inboundCredentialsRef | <code>string</code> | The reference of the inbound credentials |
| request.outboundCredentialsRef | <code>string</code> | The reference of the outbound credentials |
| request.uris | <code>Array.&lt;TrunkURI&gt;</code> | The outbound URIs of the Trunk |
| request.extended | <code>Object</code> | Optional extended attributes |

**Example**  
```js
const request = {
  ref: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  name: "Trunk from Twilio (US-East)",
}

trunks.updateTrunk(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Trunks+getTrunk"></a>

### trunks.getTrunk(ref) ⇒ <code>Promise.&lt;GetTrunkResponse&gt;</code>
Gets an Trunk from Routr.

**Kind**: instance method of [<code>Trunks</code>](#Trunks)  
**Returns**: <code>Promise.&lt;GetTrunkResponse&gt;</code> - The Trunk  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Trunk's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

trunks.getTrunk(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Trunks+deleteTrunk"></a>

### trunks.deleteTrunk(ref) ⇒ <code>Promise.&lt;void&gt;</code>
Deletes an Trunk from Routr.

**Kind**: instance method of [<code>Trunks</code>](#Trunks)  

| Param | Type | Description |
| --- | --- | --- |
| ref | <code>string</code> | The Trunk's reference |

**Example**  
```js
const ref = "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"

trunks.deleteTrunk(ref)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
<a name="Trunks+listTrunks"></a>

### trunks.listTrunks(request) ⇒ <code>Promise.&lt;ListTrunkResponse&gt;</code>
Lists all Trunks from Routr with pagination.

**Kind**: instance method of [<code>Trunks</code>](#Trunks)  
**Returns**: <code>Promise.&lt;ListTrunkResponse&gt;</code> - The list of Trunks in the current page  

| Param | Type | Description |
| --- | --- | --- |
| request | <code>ListTrunkRequest</code> | The request to list Trunks |
| request.pageSize | <code>number</code> | The number of Trunks to return |
| request.pageToken | <code>string</code> | The page token to use for pagination |

**Example**  
```js
const request = {
 pageSize: 10
}

trunks.listTrunks(request)
  .then(console.log)
  .catch(console.error)   // an error occurred
```
