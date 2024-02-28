# Custom data with the APIServer

Whether you run the Routr Connect distribution or build a custom Processor, you can store custom data with the APIServer.

The APIServer, typically used for Routr Connect, consists of objects with an `extended` property to store custom data. This `extended` property is a JSON object you can use to store any data you want.

## When to store custom data

Store custom data when you need information not part of the standard object. For instance, you might need to store an external identifier for an object, such as keeping the external identifier of a user in your external system.

You might also need to store information a Processor requires, like the `User-Agent` of a device an Agent uses, and use that information to adjust the signaling process.

## How to store custom data

To store custom data, add a property to the `extended` object. For instance, to add the external identifier of an Agent in your external system, do the following:

```javascript
const request = {
  name: "John Doe",
  username: "jdoe",
  privacy: Privacy.PRIVATE,
  domainRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  credentialsRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3",
  enabled: true,
  extended: {
    "externalId": "123456789"
  }
};

agents.createAgent(request)
  .then(console.log)
  .catch(console.error); // an error occurred
```

For additional examples of how to store custom data, see the [Node SDK](../connect/nodesdk/overview.md) and search for "extended."

## How to retrieve custom data

To retrieve custom data, read the `extended` property. For instance, to retrieve the external identifier of a user in your external system, do the following:

```javascript
agents.getAgent("8571371b-6f5d-78b1-aabe-93c5c75317a3")
  .then(agent => {
    console.log(agent.extended.externalId);
  })
  .catch(console.error); // an error occurred
```