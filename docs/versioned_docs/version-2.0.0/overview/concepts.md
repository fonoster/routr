# Concepts

Routr's approach to SIP is different from other SIP servers. For example, Routr aims to be cloud-native first. It is designed to run in a containerized environment, like Docker or Kubernetes, and features a microservices architecture.

The following concepts are essential to understand when working with Routr, but remember that we will cover them in more detail in later sections.

## EdgePort

The EdgePort component sits at the network's edge and is part of the CORE specification. It is responsible for receiving and forwarding SIP Messages.

The EdgePort service takes SIP Messages and converts them into protobuf messages. In addition to the SIP Message, we add all the metadata required for routing, including the IP of the entry point of the request, which allows us to calculate the correct path for the message statelessly.

Another essential aspect of EdgePort is that it cooperates to ensure messages follow the correct path. That means you don't need a specialized load balance in front of Routr.

Below is a diagram that demonstrates the collaboration between EdgePort and the Message Dispatcher

<img src="/img/edgeport.png" alt="EdgePort diagram" width="500"/>

One important consideration when deploying a network is the protocol for Transport. We recommend always using a connection-oriented transport such as `TCP`,`TLS`, `WS`, or `WSS`.

Downstream Processors and Middleware all use the same gRPC interface. Because they all share the same structure, we can create processing services in any programming language while maintaining the same core functionality.

A minimal EdgePort configuration looks as follows:

```yaml
# Example EdgePort configuration
kind: EdgePort
apiVersion: v2beta1
ref: edgeport-01
metadata:
  region: default
spec:
  processor:
    addr: dispatcher:51901
  methods:
    - REGISTER
    - INVITE
    - ACK
    - BYE
    - CANCEL
  transport:
    - protocol: udp
      port: 5060
```

# Message Dispatcher

The Message Dispatcher, or Dispatcher for short, is a service between the EdgePort and the Processor. It is responsible for routing SIP Messages to the correct Processor.

The Dispatcher is a stateless service that uses a simple algorithm to determine the correct processing service. The component takes the SIP Messages and applies a matching function to choose the proper Processor. 

The matching function is a Javascript function that takes the SIP Message and returns a boolean value. The Dispatcher will forward the message to the first Processor that matches the criteria. Therefore, the order of the Processors and the matching function is essential to ensure the correct routing. 

The `matchFunc` is a javascript function that leverages the JSON representation of the [SIPMessage](https://github.com/fonoster/routr/blob/main/mods/common/src/protos/sipmessage.proto) protobuf. 

This example features a Dispatcher that matches MESSAGE requests to the IM Processor and all others to the Connect Processor.

```yaml
kind: MessageDispatcher
apiVersion: v2beta1
ref: message-dispatcher
spec:
  bindAddr: 0.0.0.0:51901
  processors:
    - ref: im-processor
      addr: im:51904
      matchFunc: req => req.method === "MESSAGE"
      methods:
        - MESSAGE
    - ref: connect-processor
      addr: connect:51904
      matchFunc: req => true
      methods: 
        - REGISTER
        - INVITE
        - ACK 
        - BYE
        - CANCEL
```

The following examples show typical matching functions:

Match all SIP Messages.

```javascript
req => true
```

Match SIP Messages with a specific method.

```javascript
req => req.method === "MESSAGE"
```

Match SIP Messages with a specific method and a specific header.

```javascript
req => req.method === "MESSAGE" && req.message.from.address.uri.user === "alice"
```

Match SIP Messages with a specific `User-Agent` header.

```javascript
req => req.message.extensions.find(e => e.name === "User-Agent" && e.value.includes("Zoiper"))
```

## Location service

In Routr, the Location Service serves two primary purposes. The first purpose is to locate the route to an endpoint in the location table. The second is to load balance requests.

Routr's load balancing is done at the Location Service level and occurs in the context of Peers. To better explain this, let's take a closer look at some applications where this is useful.

For example, you can create a Peer configuration and share the same credentials if you have multiple Asterisk servers. By doing this, Routr will send a request to the instance of Asterisk according to the load-balancing algorithm you have selected.

Two balancing algorithms are available. The first is `round-robin`, and the second is `least-sessions`.

Now, let's consider a situation where you want to deploy the server and send all PSTN traffic to a conference room in Asterisk. For such a scenario, you must configure a Peer to represent your feature server and a Number to route calls from the PSTN.

To do this, create a Peer configuration for your Asterisk server similar to the following:

```yaml
apiVersion: v2beta1
kind: Peer
ref: peer-01
metadata:
  name: Asterisk (Media Server)
spec:
  aor: sip:conference@sip.local
  username: asterisk
  credentialsRef: credentials-01
  loadBalancing:
    withSessionAffinity: true
    algorithm: least-sessions
```

Notice that the load balancing section sets the `withSessionAffinity` to `true`. We need session affinity to ensure that all calls related to the conference arrive on the same Asterisk server. 

Every Asterisk server that registers using the `asterisk` username will join the same group under the `sip:conference@sip.local` Address of Record (AOR).

## Middlewares

Middleware resembles Processors because they both use the same protobuf contract but serve different purposes. While Processors hold feature logic, Middlewares addresses cross-cutting concerns like authentication, authorization, rate limiting, etc.

Some use cases for Middlewares include:

- Authentication and Authorization
- Rate limiting
- Circuit breaking
- Logging, Metrics, and Tracing
- Request and response validation
- Data transformation and normalization
- CDRs generation

Processors and Middlewares differ in that you execute Middlewares in a chain, making their execution order crucial. Additionally, you can include multiple Middlewares in your deployment but only one Processor.

## Processors

Processors are a way to extend the functionality of Routr, and implementors can add custom logic to the system. Processors are implemented as a gRPC service and use the [Alterations API](#alterations) to modify SIP messages.

The simplest possible Processor is the "Echo Processor," which returns the SIP Message to the EdgePort. The following example shows how to create an Echo Processor using Node.js.

```javascript
const Processor = require("@routr/processor").default;
const { MessageRequest, Response } = require("@routr/processor");

new Processor({ bindAddr: "0.0.0.0:51904", name: "echo" }).listen(
  (req: MessageRequest, res: Response) => {
    logger.verbose("got new request: ")
    logger.verbose(JSON.stringify(req, null, " "))
    res.sendOk()
  }
)
```

## Alterations

Alterations let you modify SIP messages. We implement Alterations as Javascript functions that a Processor or Middleware executes.

The methods for Alterations adhere to a functional programming style. In this approach, one function's output becomes the following function's input. Here's an example of how to use the Alterations API to change a SIP message:

```typescript
const { Alterations } = require('@routr/processor')
const { pipe } = require("fp-ts/function");

function messageProcessing(req: MessageRequest, route: Route): MessageRequest {
  const requestOut = pipe(
    reqIn,
    //example of an Alteration method with two arities
    Alterations.addSelfVia(route),
    Alterations.addSelfRecordRoute(route),
    Alterations.addRouteToPeerEdgePort(route),
    Alterations.addRouteToNextHop(route),
    //example of an Alteration method with one arity
    Alterations.addXEdgePortRef,
    Alterations.decreaseMaxForwards
  )

  return requestOut
}
```

If you need to create a new Alteration, we suggest you follow a similar approach to the one used by the Alterations API. That is, create a function that takes a SIP message as input and returns a SIP message as output.

## Registry service

The Registry component sends outbound registration to trunking services. You need this component when you set the sendRegister option of your Trunks to true. To send requests to the EdgePort, the Registry service depends on the Requester service.

Available configurations include the following:

| Property             | Description                                         | Required |
|----------------------|-----------------------------------------------------|----------|
| requesterAddr        | Address of service to send requests                 | Yes      |
| apiAddr              | Address of API service                              | Yes      |
| registerInterval     | Interval to send registration requests              | Yes      |
| cache                | Cache configuration                                 | Yes      |
| methods              | Acceptable SIP Methods (reserved for future use)    | No       |
| edgePorts            | List of EdgePorts for outbound registrations        | Yes      |
| edgePorts.address    | Address of EdgePort                                 | Yes      |
| edgePorts.region     | Region of EdgePort (reserved for future use)        | No       |

Here is an example of a Trunk configuration that requires registration:

```yaml
kind: Registry
apiVersion: v2beta1
spec:
  requesterAddr: requester:51909
  apiAddr: apiserver:51907
  registerInterval: 20
  cache:
    provider: memory
  methods:
    - INVITE
    - MESSAGE
  edgePorts:
    - address: sip01.edgeport.net:5060
      region: us-east1
    - address: sip02.edgeport.net:6060
```

## Requester

The Requester is a service that takes a gRPC request, converts it into a SIP message, and forwards it to its destination. It is a dependency of the Registry service.