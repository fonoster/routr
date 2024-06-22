"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[2489],{5029:(e,s,n)=>{n.r(s),n.d(s,{assets:()=>a,contentTitle:()=>c,default:()=>l,frontMatter:()=>o,metadata:()=>i,toc:()=>d});var r=n(4848),t=n(8453);const o={},c="Message Dispatcher",i={id:"development/components/dispatcher",title:"Message Dispatcher",description:"The Message Dispatcher, or Dispatcher for short, is a component responsible for receiving messages from the EdgePort and routing them to the appropriate Processor and Middleware.",source:"@site/versioned_docs/version-2.0.0/development/components/dispatcher.md",sourceDirName:"development/components",slug:"/development/components/dispatcher",permalink:"/docs/2.0.0/development/components/dispatcher",draft:!1,unlisted:!1,editUrl:"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-2.0.0/development/components/dispatcher.md",tags:[],version:"2.0.0",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"EdgePort",permalink:"/docs/2.0.0/development/components/edgeport"},next:{title:"Location Service",permalink:"/docs/2.0.0/development/components/location"}},a={},d=[{value:"Configuration Spec",id:"configuration-spec",level:2},{value:"Communication and Protobuf Spec",id:"communication-and-protobuf-spec",level:2},{value:"Launching the Dispatcher with Docker",id:"launching-the-dispatcher-with-docker",level:2},{value:"Quick Test with gRPCurl",id:"quick-test-with-grpcurl",level:2}];function h(e){const s={a:"a",code:"code",h1:"h1",h2:"h2",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,t.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(s.h1,{id:"message-dispatcher",children:"Message Dispatcher"}),"\n",(0,r.jsx)(s.p,{children:"The Message Dispatcher, or Dispatcher for short, is a component responsible for receiving messages from the EdgePort and routing them to the appropriate Processor and Middleware."}),"\n",(0,r.jsx)(s.p,{children:"The Dispatcher is required when your deployment has more than one Processor or has at least one Middleware. If your deployment has only one Processor and no Middleware, you can skip the Dispatcher and connect the EdgePort directly to the Processor."}),"\n",(0,r.jsx)(s.p,{children:"The following diagram shows the relation between the EdgePort, the Message Dispatcher, and the Message Processor."}),"\n",(0,r.jsx)(s.pre,{children:(0,r.jsx)(s.code,{className:"language-text",children:"\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510 \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510             \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502EdgePort\u2502 \u2502Message Dispatcher\u2502             \u2502Message Processor\u2502\n\u2514\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2518 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518             \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n    \u2502             \u2502                                  \u2502         \n    \u2502gRPC request \u2502                                  \u2502         \n    \u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500>\u2502                                  \u2502         \n    \u2502             \u2502                                  \u2502         \n    \u2502             \u2502findProcessor() & forwardMessage()\u2502         \n    \u2502             \u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500>\u2502         \n    \u2502             \u2502                                  \u2502         \n    \u2502             \u2502        Processed Message         \u2502         \n    \u2502             \u2502<\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502         \n    \u2502             \u2502                                  \u2502         \n    \u2502gRPC response\u2502                                  \u2502         \n    \u2502<\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502                                  \u2502         \n\u250c\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2510 \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510             \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502EdgePort\u2502 \u2502Message Dispatcher\u2502             \u2502Message Processor\u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518             \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n"})}),"\n",(0,r.jsx)(s.h2,{id:"configuration-spec",children:"Configuration Spec"}),"\n",(0,r.jsx)(s.p,{children:"To configure the Dispatcher, you must provide a YAML or JSON configuration with the following structure."}),"\n",(0,r.jsx)(s.p,{children:"You can configure the Dispatcher using a YAML or JSON file that has the following structure:"}),"\n",(0,r.jsxs)(s.table,{children:[(0,r.jsx)(s.thead,{children:(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.th,{children:"Property"}),(0,r.jsx)(s.th,{children:"Description"}),(0,r.jsx)(s.th,{children:"Required"})]})}),(0,r.jsxs)(s.tbody,{children:[(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"ref"})}),(0,r.jsx)(s.td,{children:"Reference to the Dispatcher"}),(0,r.jsx)(s.td,{children:"Yes"})]}),(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"spec.bindAddr"})}),(0,r.jsx)(s.td,{children:"Ipv4 interface to accept requests on"}),(0,r.jsx)(s.td,{children:"No"})]}),(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"spec.processors"})}),(0,r.jsx)(s.td,{children:"List of Processors"}),(0,r.jsx)(s.td,{children:"Yes"})]}),(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"spec.processors[*].ref"})}),(0,r.jsx)(s.td,{children:"Reference to the Processor"}),(0,r.jsx)(s.td,{children:"Yes"})]}),(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"spec.processors[*].matchFunc"})}),(0,r.jsx)(s.td,{children:"Matching function"}),(0,r.jsx)(s.td,{children:"Yes"})]}),(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"spec.processors[*].addr"})}),(0,r.jsx)(s.td,{children:"Address of the Processor"}),(0,r.jsx)(s.td,{children:"Yes"})]}),(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"spec.processors[*].methods"})}),(0,r.jsx)(s.td,{children:"List of SIP Methods supported by the Processor"}),(0,r.jsx)(s.td,{children:"Yes"})]}),(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"spec.middlewares"})}),(0,r.jsx)(s.td,{children:"List of Middlewares"}),(0,r.jsx)(s.td,{children:"No"})]}),(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"spec.middlewares[*].ref"})}),(0,r.jsx)(s.td,{children:"Reference to the Middleware"}),(0,r.jsx)(s.td,{children:"Yes"})]}),(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"spec.middlewares[*].addr"})}),(0,r.jsx)(s.td,{children:"Address of the Middleware"}),(0,r.jsx)(s.td,{children:"Yes"})]}),(0,r.jsxs)(s.tr,{children:[(0,r.jsx)(s.td,{children:(0,r.jsx)(s.code,{children:"spec.middlewares[*].postProcessor"})}),(0,r.jsx)(s.td,{children:"Whether to process the SIP Message after the Processor"}),(0,r.jsx)(s.td,{children:"Yes"})]})]})]}),"\n",(0,r.jsx)(s.p,{children:"Here is an example of a configuration file:"}),"\n",(0,r.jsxs)(s.p,{children:["Filename: ",(0,r.jsx)(s.code,{children:"dispatcher.yaml"})," or ",(0,r.jsx)(s.code,{children:"dispatcher.json"})]}),"\n",(0,r.jsx)(s.pre,{children:(0,r.jsx)(s.code,{className:"language-yaml",children:"kind: MessageDispatcher\napiVersion: v2beta1\nref: message-dispatcher\nspec:\n  bindAddr: 0.0.0.0:51901\n  processors:\n    - ref: connect-processor\n      addr: connect:51904\n      matchFunc: req => true\n      methods:\n        - REGISTER\n        - MESSAGE\n        - INVITE\n        - ACK\n        - BYE\n        - CANCEL\n"})}),"\n",(0,r.jsx)(s.p,{children:"The matching function is a Javascript function that takes the SIP Message and returns a boolean value. The Dispatcher will forward the message to the first Processor that matches the criteria. Therefore, the order of the Processors and the matching function is essential to ensure the correct routing."}),"\n",(0,r.jsxs)(s.p,{children:["The ",(0,r.jsx)(s.code,{children:"matchFunc"})," is a javascript function that leverages the JSON representation of the ",(0,r.jsx)(s.a,{href:"https://github.com/fonoster/routr/blob/main/mods/common/src/protos/sipmessage.proto",children:"SIPMessage"})," protobuf."]}),"\n",(0,r.jsx)(s.p,{children:"This example features a Dispatcher that matches MESSAGE requests to the IM Processor and all others to the Connect Processor."}),"\n",(0,r.jsx)(s.pre,{children:(0,r.jsx)(s.code,{className:"language-yaml",children:'kind: MessageDispatcher\napiVersion: v2beta1\nref: message-dispatcher\nspec:\n  bindAddr: 0.0.0.0:51901\n  processors:\n    - ref: im-processor\n      addr: im:51904\n      matchFunc: req => req.method === "MESSAGE"\n      methods:\n        - MESSAGE\n    - ref: connect-processor\n      addr: connect:51904\n      matchFunc: req => true\n      methods: \n        - REGISTER\n        - INVITE\n        - ACK \n        - BYE\n        - CANCEL\n'})}),"\n",(0,r.jsx)(s.p,{children:"The following examples show typical matching functions:"}),"\n",(0,r.jsx)(s.p,{children:"Match all SIP Messages."}),"\n",(0,r.jsx)(s.pre,{children:(0,r.jsx)(s.code,{className:"language-javascript",children:"req => true\n"})}),"\n",(0,r.jsx)(s.p,{children:"Match SIP Messages with a specific method."}),"\n",(0,r.jsx)(s.pre,{children:(0,r.jsx)(s.code,{className:"language-javascript",children:'req => req.method === "MESSAGE"\n'})}),"\n",(0,r.jsx)(s.p,{children:"Match SIP Messages with a specific method and a specific header."}),"\n",(0,r.jsx)(s.pre,{children:(0,r.jsx)(s.code,{className:"language-javascript",children:'req => req.method === "MESSAGE" && req.message.from.address.uri.user === "alice"\n'})}),"\n",(0,r.jsxs)(s.p,{children:["Match SIP Messages with a specific ",(0,r.jsx)(s.code,{children:"User-Agent"})," header."]}),"\n",(0,r.jsx)(s.pre,{children:(0,r.jsx)(s.code,{className:"language-javascript",children:'req => req.message.extensions.find(e => e.name === "User-Agent" && e.value.includes("Zoiper"))\n'})}),"\n",(0,r.jsx)(s.h2,{id:"communication-and-protobuf-spec",children:"Communication and Protobuf Spec"}),"\n",(0,r.jsx)(s.p,{children:"The Message Dispatcher uses gRPC to communicate with the Processors and Middlewares, which happen to share the protobuf definition:"}),"\n",(0,r.jsx)(s.pre,{children:(0,r.jsx)(s.code,{className:"language-protobuf",children:'syntax = "proto3";\n\npackage fonoster.routr.processor.v2beta1;\n\nimport "common.proto";\nimport "sipmessage.proto";\n\n// Processor service\nservice Processor {\n  // Process Message Request\n  rpc ProcessMessage (MessageRequest) returns (MessageResponse) {}\n}\n\nenum Method {\n  UNKNOWN = 0;\n  // Communicates user location (hostname, IP)\n  REGISTER = 1;\n  // Establishes a session\n  INVITE = 2;\n  // Transports Instant Messages\n  MESSAGE = 3;\n  // Publishes an event to the Server\n  PUBLISH = 4;\n  // Notifies the subscriber of a new event\n  NOTIFY = 5;\n  // Subscribes for Notification from the notifier\n  SUBSCRIBE = 6;\n  // Confirms an INVITE request\n  ACK = 7;\n  // Terminates a session\n  BYE = 8;\n  // Cancels establishing of a session\n  CANCEL = 9;\n  // Communicates information about the capabilities of the calling and receiving SIP phones\n  OPTIONS = 10;\n  // Provisional Acknowledgement\n  PRACK = 11;\n  // Sends mid-session information\n  INFO = 12;\n  // Asks the recipient to issue a call transfer\n  REFER = 13;\n  // Modifies the state of a session\n  UPDATE = 14;\n}\n\nmessage NetInterface {\n  string host = 1;\n  int32 port = 2;\n  fonoster.routr.common.v2beta1.Transport transport = 3;\n}\n\nmessage MessageRequest {\n  // Same as the Call-Id header \n  string ref = 1;\n  string edge_port_ref = 2;\n  Method method = 3;\n  NetInterface sender = 4;\n  repeated NetInterface listening_points = 5;\n  repeated string external_addrs = 6;\n  repeated string localnets = 7;\n  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 8;\n  map<string, string> metadata = 9;\n}\n\nmessage MessageResponse {\n  NetInterface sender = 1;\n  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 2;\n  map<string, string> metadata = 3;\n}\n'})}),"\n",(0,r.jsxs)(s.p,{children:["Link to the ",(0,r.jsx)(s.a,{href:"https://github.com/fonoster/routr/blob/main/mods/common/src/protos/processor.proto",children:"protobuf definition."})]}),"\n",(0,r.jsx)(s.h2,{id:"launching-the-dispatcher-with-docker",children:"Launching the Dispatcher with Docker"}),"\n",(0,r.jsxs)(s.p,{children:["The Message Dispatcher is available as a Docker image from ",(0,r.jsx)(s.a,{href:"https://hub.docker.com/r/fonoster/routr-dispatcher",children:"Docker Hub"}),". To launch the Dispatcher with Docker, you can use the following command:"]}),"\n",(0,r.jsx)(s.pre,{children:(0,r.jsx)(s.code,{className:"language-bash",children:"docker run -it -v $(pwd)/dispatcher.yaml:/etc/routr/dispatcher.yaml -p 51901:51901 fonoster/routr-dispatcher\n"})}),"\n",(0,r.jsxs)(s.p,{children:["The previous example will pull the latest version of the Dispatcher from Docker Hub and launch it with the default configuration. The Dispatcher will be listening on port ",(0,r.jsx)(s.code,{children:"51901"})," for gRPC requests. Remember, your Docker container must expose the ports in your configuration file. By default, the Dispatcher listens on port ",(0,r.jsx)(s.code,{children:"51901"}),"."]}),"\n",(0,r.jsx)(s.h2,{id:"quick-test-with-grpcurl",children:"Quick Test with gRPCurl"}),"\n",(0,r.jsxs)(s.p,{children:["One easy way to interact with the Dispatcher for testing and development is to use ",(0,r.jsx)(s.a,{href:"https://github.com/fullstorydev/grpcurl",children:"gRPCurl"}),". The following example shows how to send a SIP Message to the Dispatcher."]}),"\n",(0,r.jsx)(s.pre,{children:(0,r.jsx)(s.code,{className:"language-bash",children:"grpcurl -plaintext \\\n  -import-path /path/to/protos \\\n  -proto processor.proto  -d '{...}' \\\n  localhost:51901 \\\n  fonoster.routr.processor.v2beta1.Processor/ProcessMessage\n"})})]})}function l(e={}){const{wrapper:s}={...(0,t.R)(),...e.components};return s?(0,r.jsx)(s,{...e,children:(0,r.jsx)(h,{...e})}):h(e)}},8453:(e,s,n)=>{n.d(s,{R:()=>c,x:()=>i});var r=n(6540);const t={},o=r.createContext(t);function c(e){const s=r.useContext(o);return r.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function i(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:c(e.components),r.createElement(o.Provider,{value:s},e.children)}}}]);