# Overview

Node.js SDK is a library that you can use to manage your Routr Connect server. It is available as an npm package that allows you to create, read, update, and delete (CRUD) resources in your server.

This tool serves as an important component of the Routr Connect server. It is used by the command-line tool to manage your server and the Routr Connect API to manage the server.

The following example demonstrates how you can use the Node.js SDK to create a new Domain.

To begin using the Node.js SDK, first make sure you have Node and NPM installed. Then, start by creating a new project and installing the Routr Connect SDK.

Let’s begin by creating a new project:

```bash
mkdir my-project 
cd my-project 
npm init -y
```

The previous command will create a new directory called "my-project" and initialize a new npm project using the default settings.
Next, install the SDK width:

```bash
npm install --save @routr/sdk
```

The --save flag will add the SDK as a dependency to your project. Now, create a new file called index.js and add the following code: 

Filename: index.js

```javascript
const SDK = require("@routr/sdk");
const domains = new SDK.Domains();

const request = {
  name: "Local domain",
  domainUri: "sip.local",
  accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3", 
  egressPolicies: [{
    rule: ".*",
    numberRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
  }],
  extended: { "key": "value" } 
};

domains.createDomain(request)
  .then(console.log)
  .catch(console.error); // an error occurred
```

In the example above, we assume that the ACL and Number already exist. However, if you need to create those resources, you can use the SDK to do so or use the command-line tool.

The extended field is available for you to add custom fields to your resources. This is useful when you want to add metadata to your resources (e.g., an external ID)

Now, go ahead and run the code:

```bash
node index.js
```

If everything executed properly, you should now have a new Domain created in your Routr Connect server. This is just a simple example of how to use the Node.js SDK. For complete documentation, please visit the npm page for @routr/sdk at https://www.npmjs.com/package/@routr/sdk. 

Also, If you prefer using a different language, you can use the gRPC API directly by leveraging the proto files available at https://github.com/fonoster/routr/tree/main/mods/common/src/connect/protos.