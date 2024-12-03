"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[5558],{4226:(e,s,r)=>{r.r(s),r.d(s,{assets:()=>c,contentTitle:()=>a,default:()=>h,frontMatter:()=>i,metadata:()=>t,toc:()=>d});const t=JSON.parse('{"id":"overview/concepts","title":"Concepts","description":"Routr\'s approach to SIP is different from other SIP servers. For example, Routr aims to be cloud-native first. It is designed to run in a containerized environment, like Docker or Kubernetes, and features a microservices architecture.","source":"@site/versioned_docs/version-2.0.0/overview/concepts.md","sourceDirName":"overview","slug":"/overview/concepts","permalink":"/docs/2.0.0/overview/concepts","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-2.0.0/overview/concepts.md","tags":[],"version":"2.0.0","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Architecture","permalink":"/docs/2.0.0/overview/architecture"},"next":{"title":"Deploy with Docker","permalink":"/docs/2.0.0/overview/deploy-with-docker"}}');var n=r(4848),o=r(8453);const i={},a="Concepts",c={},d=[{value:"EdgePort",id:"edgeport",level:2},{value:"Location service",id:"location-service",level:2},{value:"Middlewares",id:"middlewares",level:2},{value:"Processors",id:"processors",level:2},{value:"Alterations",id:"alterations",level:2},{value:"Registry service",id:"registry-service",level:2},{value:"Requester",id:"requester",level:2}];function l(e){const s={a:"a",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,o.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(s.header,{children:(0,n.jsx)(s.h1,{id:"concepts",children:"Concepts"})}),"\n",(0,n.jsx)(s.p,{children:"Routr's approach to SIP is different from other SIP servers. For example, Routr aims to be cloud-native first. It is designed to run in a containerized environment, like Docker or Kubernetes, and features a microservices architecture."}),"\n",(0,n.jsx)(s.p,{children:"The following concepts are essential to understand when working with Routr, but remember that we will cover them in more detail in later sections."}),"\n",(0,n.jsx)(s.h2,{id:"edgeport",children:"EdgePort"}),"\n",(0,n.jsx)(s.p,{children:"The EdgePort component sits at the network's edge and is part of the CORE specification. It is responsible for receiving and forwarding SIP Messages."}),"\n",(0,n.jsx)(s.p,{children:"The EdgePort service takes SIP Messages and converts them into protobuf messages. In addition to the SIP Message, we add all the metadata required for routing, including the IP of the entry point of the request, which allows us to calculate the correct path for the message statelessly."}),"\n",(0,n.jsx)(s.p,{children:"Another essential aspect of EdgePort is that it cooperates to ensure messages follow the correct path. That means you don't need a specialized load balance in front of Routr."}),"\n",(0,n.jsx)(s.p,{children:"Below is a diagram that demonstrates the collaboration between EdgePort and the Message Dispatcher"}),"\n",(0,n.jsx)("img",{src:"/img/edgeport.png",alt:"EdgePort diagram",width:"500"}),"\n",(0,n.jsxs)(s.p,{children:["One important consideration when deploying a network is the protocol for Transport. We recommend always using a connection-oriented transport such as ",(0,n.jsx)(s.code,{children:"TCP"}),",",(0,n.jsx)(s.code,{children:"TLS"}),", ",(0,n.jsx)(s.code,{children:"WS"}),", or ",(0,n.jsx)(s.code,{children:"WSS"}),"."]}),"\n",(0,n.jsx)(s.p,{children:"Downstream Processors and Middleware all use the same gRPC interface. Because they all share the same structure, we can create processing services in any programming language while maintaining the same core functionality."}),"\n",(0,n.jsx)(s.p,{children:"A minimal EdgePort configuration looks as follows:"}),"\n",(0,n.jsx)(s.pre,{children:(0,n.jsx)(s.code,{className:"language-yaml",children:"# Example EdgePort configuration\nkind: EdgePort\napiVersion: v2beta1\nref: edgeport-01\nmetadata:\n  region: default\nspec:\n  processor:\n    addr: dispatcher:51901\n  methods:\n    - REGISTER\n    - INVITE\n    - ACK\n    - BYE\n    - CANCEL\n  transport:\n    - protocol: udp\n      port: 5060\n"})}),"\n",(0,n.jsx)(s.h1,{id:"message-dispatcher",children:"Message Dispatcher"}),"\n",(0,n.jsx)(s.p,{children:"The Message Dispatcher, or Dispatcher for short, is a service between the EdgePort and the Processor. It is responsible for routing SIP Messages to the correct Processor."}),"\n",(0,n.jsx)(s.p,{children:"The Dispatcher is a stateless service that uses a simple algorithm to determine the correct processing service. The component takes the SIP Messages and applies a matching function to choose the proper Processor."}),"\n",(0,n.jsx)(s.p,{children:"The matching function is a Javascript function that takes the SIP Message and returns a boolean value. The Dispatcher will forward the message to the first Processor that matches the criteria. Therefore, the order of the Processors and the matching function is essential to ensure the correct routing."}),"\n",(0,n.jsxs)(s.p,{children:["The ",(0,n.jsx)(s.code,{children:"matchFunc"})," is a javascript function that leverages the JSON representation of the ",(0,n.jsx)(s.a,{href:"https://github.com/fonoster/routr/blob/main/mods/common/src/protos/sipmessage.proto",children:"SIPMessage"})," protobuf."]}),"\n",(0,n.jsx)(s.p,{children:"This example features a Dispatcher that matches MESSAGE requests to the IM Processor and all others to the Connect Processor."}),"\n",(0,n.jsx)(s.pre,{children:(0,n.jsx)(s.code,{className:"language-yaml",children:'kind: MessageDispatcher\napiVersion: v2beta1\nref: message-dispatcher\nspec:\n  bindAddr: 0.0.0.0:51901\n  processors:\n    - ref: im-processor\n      addr: im:51904\n      matchFunc: req => req.method === "MESSAGE"\n      methods:\n        - MESSAGE\n    - ref: connect-processor\n      addr: connect:51904\n      matchFunc: req => true\n      methods: \n        - REGISTER\n        - INVITE\n        - ACK \n        - BYE\n        - CANCEL\n'})}),"\n",(0,n.jsx)(s.p,{children:"The following examples show typical matching functions:"}),"\n",(0,n.jsx)(s.p,{children:"Match all SIP Messages."}),"\n",(0,n.jsx)(s.pre,{children:(0,n.jsx)(s.code,{className:"language-javascript",children:"req => true\n"})}),"\n",(0,n.jsx)(s.p,{children:"Match SIP Messages with a specific method."}),"\n",(0,n.jsx)(s.pre,{children:(0,n.jsx)(s.code,{className:"language-javascript",children:'req => req.method === "MESSAGE"\n'})}),"\n",(0,n.jsx)(s.p,{children:"Match SIP Messages with a specific method and a specific header."}),"\n",(0,n.jsx)(s.pre,{children:(0,n.jsx)(s.code,{className:"language-javascript",children:'req => req.method === "MESSAGE" && req.message.from.address.uri.user === "alice"\n'})}),"\n",(0,n.jsxs)(s.p,{children:["Match SIP Messages with a specific ",(0,n.jsx)(s.code,{children:"User-Agent"})," header."]}),"\n",(0,n.jsx)(s.pre,{children:(0,n.jsx)(s.code,{className:"language-javascript",children:'req => req.message.extensions.find(e => e.name === "User-Agent" && e.value.includes("Zoiper"))\n'})}),"\n",(0,n.jsx)(s.h2,{id:"location-service",children:"Location service"}),"\n",(0,n.jsx)(s.p,{children:"In Routr, the Location Service serves two primary purposes. The first purpose is to locate the route to an endpoint in the location table. The second is to load balance requests."}),"\n",(0,n.jsx)(s.p,{children:"Routr's load balancing is done at the Location Service level and occurs in the context of Peers. To better explain this, let's take a closer look at some applications where this is useful."}),"\n",(0,n.jsx)(s.p,{children:"For example, you can create a Peer configuration and share the same credentials if you have multiple Asterisk servers. By doing this, Routr will send a request to the instance of Asterisk according to the load-balancing algorithm you have selected."}),"\n",(0,n.jsxs)(s.p,{children:["Two balancing algorithms are available. The first is ",(0,n.jsx)(s.code,{children:"round-robin"}),", and the second is ",(0,n.jsx)(s.code,{children:"least-sessions"}),"."]}),"\n",(0,n.jsx)(s.p,{children:"Now, let's consider a situation where you want to deploy the server and send all PSTN traffic to a conference room in Asterisk. For such a scenario, you must configure a Peer to represent your feature server and a Number to route calls from the PSTN."}),"\n",(0,n.jsx)(s.p,{children:"To do this, create a Peer configuration for your Asterisk server similar to the following:"}),"\n",(0,n.jsx)(s.pre,{children:(0,n.jsx)(s.code,{className:"language-yaml",children:"apiVersion: v2beta1\nkind: Peer\nref: peer-01\nmetadata:\n  name: Asterisk (Media Server)\nspec:\n  aor: sip:conference@sip.local\n  username: asterisk\n  credentialsRef: credentials-01\n  loadBalancing:\n    withSessionAffinity: true\n    algorithm: least-sessions\n"})}),"\n",(0,n.jsxs)(s.p,{children:["Notice that the load balancing section sets the ",(0,n.jsx)(s.code,{children:"withSessionAffinity"})," to ",(0,n.jsx)(s.code,{children:"true"}),". We need session affinity to ensure that all calls related to the conference arrive on the same Asterisk server."]}),"\n",(0,n.jsxs)(s.p,{children:["Every Asterisk server that registers using the ",(0,n.jsx)(s.code,{children:"asterisk"})," username will join the same group under the ",(0,n.jsx)(s.code,{children:"sip:conference@sip.local"})," Address of Record (AOR)."]}),"\n",(0,n.jsx)(s.h2,{id:"middlewares",children:"Middlewares"}),"\n",(0,n.jsx)(s.p,{children:"Middleware resembles Processors because they both use the same protobuf contract but serve different purposes. While Processors hold feature logic, Middlewares addresses cross-cutting concerns like authentication, authorization, rate limiting, etc."}),"\n",(0,n.jsx)(s.p,{children:"Some use cases for Middlewares include:"}),"\n",(0,n.jsxs)(s.ul,{children:["\n",(0,n.jsx)(s.li,{children:"Authentication and Authorization"}),"\n",(0,n.jsx)(s.li,{children:"Rate limiting"}),"\n",(0,n.jsx)(s.li,{children:"Circuit breaking"}),"\n",(0,n.jsx)(s.li,{children:"Logging, Metrics, and Tracing"}),"\n",(0,n.jsx)(s.li,{children:"Request and response validation"}),"\n",(0,n.jsx)(s.li,{children:"Data transformation and normalization"}),"\n",(0,n.jsx)(s.li,{children:"CDRs generation"}),"\n"]}),"\n",(0,n.jsx)(s.p,{children:"Processors and Middlewares differ in that you execute Middlewares in a chain, making their execution order crucial. Additionally, you can include multiple Middlewares in your deployment but only one Processor."}),"\n",(0,n.jsx)(s.h2,{id:"processors",children:"Processors"}),"\n",(0,n.jsxs)(s.p,{children:["Processors are a way to extend the functionality of Routr, and implementors can add custom logic to the system. Processors are implemented as a gRPC service and use the ",(0,n.jsx)(s.a,{href:"#alterations",children:"Alterations API"})," to modify SIP messages."]}),"\n",(0,n.jsx)(s.p,{children:'The simplest possible Processor is the "Echo Processor," which returns the SIP Message to the EdgePort. The following example shows how to create an Echo Processor using Node.js.'}),"\n",(0,n.jsx)(s.pre,{children:(0,n.jsx)(s.code,{className:"language-javascript",children:'const Processor = require("@routr/processor").default;\nconst { MessageRequest, Response } = require("@routr/processor");\n\nnew Processor({ bindAddr: "0.0.0.0:51904", name: "echo" }).listen(\n  (req: MessageRequest, res: Response) => {\n    logger.verbose("got new request: ")\n    logger.verbose(JSON.stringify(req, null, " "))\n    res.sendOk()\n  }\n)\n'})}),"\n",(0,n.jsx)(s.h2,{id:"alterations",children:"Alterations"}),"\n",(0,n.jsx)(s.p,{children:"Alterations let you modify SIP messages. We implement Alterations as Javascript functions that a Processor or Middleware executes."}),"\n",(0,n.jsx)(s.p,{children:"The methods for Alterations adhere to a functional programming style. In this approach, one function's output becomes the following function's input. Here's an example of how to use the Alterations API to change a SIP message:"}),"\n",(0,n.jsx)(s.pre,{children:(0,n.jsx)(s.code,{className:"language-typescript",children:"const { Alterations } = require('@routr/processor')\nconst { pipe } = require(\"fp-ts/function\");\n\nfunction messageProcessing(req: MessageRequest, route: Route): MessageRequest {\n  const requestOut = pipe(\n    reqIn,\n    //example of an Alteration method with two arities\n    Alterations.addSelfVia(route),\n    Alterations.addSelfRecordRoute(route),\n    Alterations.addRouteToPeerEdgePort(route),\n    Alterations.addRouteToNextHop(route),\n    //example of an Alteration method with one arity\n    Alterations.addXEdgePortRef,\n    Alterations.decreaseMaxForwards\n  )\n\n  return requestOut\n}\n"})}),"\n",(0,n.jsx)(s.p,{children:"If you need to create a new Alteration, we suggest you follow a similar approach to the one used by the Alterations API. That is, create a function that takes a SIP message as input and returns a SIP message as output."}),"\n",(0,n.jsx)(s.h2,{id:"registry-service",children:"Registry service"}),"\n",(0,n.jsx)(s.p,{children:"The Registry component sends outbound registration to trunking services. You need this component when you set the sendRegister option of your Trunks to true. To send requests to the EdgePort, the Registry service depends on the Requester service."}),"\n",(0,n.jsx)(s.p,{children:"Available configurations include the following:"}),"\n",(0,n.jsxs)(s.table,{children:[(0,n.jsx)(s.thead,{children:(0,n.jsxs)(s.tr,{children:[(0,n.jsx)(s.th,{children:"Property"}),(0,n.jsx)(s.th,{children:"Description"}),(0,n.jsx)(s.th,{children:"Required"})]})}),(0,n.jsxs)(s.tbody,{children:[(0,n.jsxs)(s.tr,{children:[(0,n.jsx)(s.td,{children:"requesterAddr"}),(0,n.jsx)(s.td,{children:"Address of service to send requests"}),(0,n.jsx)(s.td,{children:"Yes"})]}),(0,n.jsxs)(s.tr,{children:[(0,n.jsx)(s.td,{children:"apiAddr"}),(0,n.jsx)(s.td,{children:"Address of API service"}),(0,n.jsx)(s.td,{children:"Yes"})]}),(0,n.jsxs)(s.tr,{children:[(0,n.jsx)(s.td,{children:"registerInterval"}),(0,n.jsx)(s.td,{children:"Interval to send registration requests"}),(0,n.jsx)(s.td,{children:"Yes"})]}),(0,n.jsxs)(s.tr,{children:[(0,n.jsx)(s.td,{children:"cache"}),(0,n.jsx)(s.td,{children:"Cache configuration"}),(0,n.jsx)(s.td,{children:"Yes"})]}),(0,n.jsxs)(s.tr,{children:[(0,n.jsx)(s.td,{children:"methods"}),(0,n.jsx)(s.td,{children:"Acceptable SIP Methods (reserved for future use)"}),(0,n.jsx)(s.td,{children:"No"})]}),(0,n.jsxs)(s.tr,{children:[(0,n.jsx)(s.td,{children:"edgePorts"}),(0,n.jsx)(s.td,{children:"List of EdgePorts for outbound registrations"}),(0,n.jsx)(s.td,{children:"Yes"})]}),(0,n.jsxs)(s.tr,{children:[(0,n.jsx)(s.td,{children:"edgePorts.address"}),(0,n.jsx)(s.td,{children:"Address of EdgePort"}),(0,n.jsx)(s.td,{children:"Yes"})]}),(0,n.jsxs)(s.tr,{children:[(0,n.jsx)(s.td,{children:"edgePorts.region"}),(0,n.jsx)(s.td,{children:"Region of EdgePort (reserved for future use)"}),(0,n.jsx)(s.td,{children:"No"})]})]})]}),"\n",(0,n.jsx)(s.p,{children:"Here is an example of a Trunk configuration that requires registration:"}),"\n",(0,n.jsx)(s.pre,{children:(0,n.jsx)(s.code,{className:"language-yaml",children:"kind: Registry\napiVersion: v2beta1\nspec:\n  requesterAddr: requester:51909\n  apiAddr: apiserver:51907\n  registerInterval: 20\n  cache:\n    provider: memory\n  methods:\n    - INVITE\n    - MESSAGE\n  edgePorts:\n    - address: sip01.edgeport.net:5060\n      region: us-east1\n    - address: sip02.edgeport.net:6060\n"})}),"\n",(0,n.jsx)(s.h2,{id:"requester",children:"Requester"}),"\n",(0,n.jsx)(s.p,{children:"The Requester is a service that takes a gRPC request, converts it into a SIP message, and forwards it to its destination. It is a dependency of the Registry service."})]})}function h(e={}){const{wrapper:s}={...(0,o.R)(),...e.components};return s?(0,n.jsx)(s,{...e,children:(0,n.jsx)(l,{...e})}):l(e)}},8453:(e,s,r)=>{r.d(s,{R:()=>i,x:()=>a});var t=r(6540);const n={},o=t.createContext(n);function i(e){const s=t.useContext(o);return t.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function a(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:i(e.components),t.createElement(o.Provider,{value:s},e.children)}}}]);