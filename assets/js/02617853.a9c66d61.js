"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[9949],{3905:(e,t,n)=>{n.d(t,{Zo:()=>c,kt:()=>h});var r=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function s(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function o(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?s(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):s(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function i(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},s=Object.keys(e);for(r=0;r<s.length;r++)n=s[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var s=Object.getOwnPropertySymbols(e);for(r=0;r<s.length;r++)n=s[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var l=r.createContext({}),p=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):o(o({},t),e)),n},c=function(e){var t=p(e.components);return r.createElement(l.Provider,{value:t},e.children)},d="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},u=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,s=e.originalType,l=e.parentName,c=i(e,["components","mdxType","originalType","parentName"]),d=p(n),u=a,h=d["".concat(l,".").concat(u)]||d[u]||m[u]||s;return n?r.createElement(h,o(o({ref:t},c),{},{components:n})):r.createElement(h,o({ref:t},c))}));function h(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var s=n.length,o=new Array(s);o[0]=u;var i={};for(var l in t)hasOwnProperty.call(t,l)&&(i[l]=t[l]);i.originalType=e,i[d]="string"==typeof e?e:a,o[1]=i;for(var p=2;p<s;p++)o[p]=n[p];return r.createElement.apply(null,o)}return r.createElement.apply(null,n)}u.displayName="MDXCreateElement"},8747:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>o,default:()=>m,frontMatter:()=>s,metadata:()=>i,toc:()=>p});var r=n(7462),a=(n(7294),n(3905));const s={},o="Message Dispatcher",i={unversionedId:"development/components/dispatcher",id:"development/components/dispatcher",title:"Message Dispatcher",description:"The Message Dispatcher, or Dispatcher for short, is a component responsible for receiving messages from the EdgePort and routing them to the appropriate Processor and Middleware.",source:"@site/docs/development/components/dispatcher.md",sourceDirName:"development/components",slug:"/development/components/dispatcher",permalink:"/docs/2.0.0/development/components/dispatcher",draft:!1,editUrl:"https://github.com/fonoster/routr-website/edit/main/docs/development/components/dispatcher.md",tags:[],version:"current",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"EdgePort",permalink:"/docs/2.0.0/development/components/edgeport"},next:{title:"Location Service",permalink:"/docs/2.0.0/development/components/location"}},l={},p=[{value:"Configuration Spec",id:"configuration-spec",level:2},{value:"Communication and Protobuf Spec",id:"communication-and-protobuf-spec",level:2},{value:"Launching the Dispatcher with Docker",id:"launching-the-dispatcher-with-docker",level:2},{value:"Quick Test with gRPCurl",id:"quick-test-with-grpcurl",level:2}],c={toc:p},d="wrapper";function m(e){let{components:t,...n}=e;return(0,a.kt)(d,(0,r.Z)({},c,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"message-dispatcher"},"Message Dispatcher"),(0,a.kt)("p",null,"The Message Dispatcher, or Dispatcher for short, is a component responsible for receiving messages from the EdgePort and routing them to the appropriate Processor and Middleware."),(0,a.kt)("p",null,"The Dispatcher is required when your deployment has more than one Processor or has at least one Middleware. If your deployment has only one Processor and no Middleware, you can skip the Dispatcher and connect the EdgePort directly to the Processor."),(0,a.kt)("p",null,"The following diagram shows the relation between the EdgePort, the Message Dispatcher, and the Message Processor."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-text"},"\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510 \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510             \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502EdgePort\u2502 \u2502Message Dispatcher\u2502             \u2502Message Processor\u2502\n\u2514\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2518 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518             \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n    \u2502             \u2502                                  \u2502         \n    \u2502gRPC request \u2502                                  \u2502         \n    \u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500>\u2502                                  \u2502         \n    \u2502             \u2502                                  \u2502         \n    \u2502             \u2502findProcessor() & forwardMessage()\u2502         \n    \u2502             \u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500>\u2502         \n    \u2502             \u2502                                  \u2502         \n    \u2502             \u2502        Processed Message         \u2502         \n    \u2502             \u2502<\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502         \n    \u2502             \u2502                                  \u2502         \n    \u2502gRPC response\u2502                                  \u2502         \n    \u2502<\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502                                  \u2502         \n\u250c\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2510 \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510             \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502EdgePort\u2502 \u2502Message Dispatcher\u2502             \u2502Message Processor\u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518             \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n")),(0,a.kt)("h2",{id:"configuration-spec"},"Configuration Spec"),(0,a.kt)("p",null,"To configure the Dispatcher, you must provide a YAML or JSON configuration with the following structure."),(0,a.kt)("p",null,"You can configure the Dispatcher using a YAML or JSON file that has the following structure:"),(0,a.kt)("table",null,(0,a.kt)("thead",{parentName:"table"},(0,a.kt)("tr",{parentName:"thead"},(0,a.kt)("th",{parentName:"tr",align:null},"Property"),(0,a.kt)("th",{parentName:"tr",align:null},"Description"),(0,a.kt)("th",{parentName:"tr",align:null},"Required"))),(0,a.kt)("tbody",{parentName:"table"},(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"ref")),(0,a.kt)("td",{parentName:"tr",align:null},"Reference to the Dispatcher"),(0,a.kt)("td",{parentName:"tr",align:null},"Yes")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"spec.bindAddr")),(0,a.kt)("td",{parentName:"tr",align:null},"Ipv4 interface to accept requests on"),(0,a.kt)("td",{parentName:"tr",align:null},"No")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"spec.processors")),(0,a.kt)("td",{parentName:"tr",align:null},"List of Processors"),(0,a.kt)("td",{parentName:"tr",align:null},"Yes")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"spec.processors[*].ref")),(0,a.kt)("td",{parentName:"tr",align:null},"Reference to the Processor"),(0,a.kt)("td",{parentName:"tr",align:null},"Yes")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"spec.processors[*].matchFunc")),(0,a.kt)("td",{parentName:"tr",align:null},"Matching function"),(0,a.kt)("td",{parentName:"tr",align:null},"Yes")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"spec.processors[*].addr")),(0,a.kt)("td",{parentName:"tr",align:null},"Address of the Processor"),(0,a.kt)("td",{parentName:"tr",align:null},"Yes")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"spec.processors[*].methods")),(0,a.kt)("td",{parentName:"tr",align:null},"List of SIP Methods supported by the Processor"),(0,a.kt)("td",{parentName:"tr",align:null},"Yes")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"spec.middlewares")),(0,a.kt)("td",{parentName:"tr",align:null},"List of Middlewares"),(0,a.kt)("td",{parentName:"tr",align:null},"No")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"spec.middlewares[*].ref")),(0,a.kt)("td",{parentName:"tr",align:null},"Reference to the Middleware"),(0,a.kt)("td",{parentName:"tr",align:null},"Yes")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"spec.middlewares[*].addr")),(0,a.kt)("td",{parentName:"tr",align:null},"Address of the Middleware"),(0,a.kt)("td",{parentName:"tr",align:null},"Yes")),(0,a.kt)("tr",{parentName:"tbody"},(0,a.kt)("td",{parentName:"tr",align:null},(0,a.kt)("inlineCode",{parentName:"td"},"spec.middlewares[*].postProcessor")),(0,a.kt)("td",{parentName:"tr",align:null},"Whether to process the SIP Message after the Processor"),(0,a.kt)("td",{parentName:"tr",align:null},"Yes")))),(0,a.kt)("p",null,"Here is an example of a configuration file:"),(0,a.kt)("p",null,"Filename: ",(0,a.kt)("inlineCode",{parentName:"p"},"dispatcher.yaml")," or ",(0,a.kt)("inlineCode",{parentName:"p"},"dispatcher.json")),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-yaml"},"kind: MessageDispatcher\napiVersion: v2beta1\nref: message-dispatcher\nspec:\n  bindAddr: 0.0.0.0:51901\n  processors:\n    - ref: connect-processor\n      addr: connect:51904\n      matchFunc: req => true\n      methods:\n        - REGISTER\n        - MESSAGE\n        - INVITE\n        - ACK\n        - BYE\n        - CANCEL\n")),(0,a.kt)("p",null,"The matching function is a Javascript function that takes the SIP Message and returns a boolean value. The Dispatcher will forward the message to the first Processor that matches the criteria. Therefore, the order of the Processors and the matching function is essential to ensure the correct routing. "),(0,a.kt)("p",null,"The ",(0,a.kt)("inlineCode",{parentName:"p"},"matchFunc")," is a javascript function that leverages the JSON representation of the ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/fonoster/routr/blob/main/mods/common/src/protos/sipmessage.proto"},"SIPMessage")," protobuf. "),(0,a.kt)("p",null,"This example features a Dispatcher that matches MESSAGE requests to the IM Processor and all others to the Connect Processor."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-yaml"},'kind: MessageDispatcher\napiVersion: v2beta1\nref: message-dispatcher\nspec:\n  bindAddr: 0.0.0.0:51901\n  processors:\n    - ref: im-processor\n      addr: im:51904\n      matchFunc: req => req.method === "MESSAGE"\n      methods:\n        - MESSAGE\n    - ref: connect-processor\n      addr: connect:51904\n      matchFunc: req => true\n      methods: \n        - REGISTER\n        - INVITE\n        - ACK \n        - BYE\n        - CANCEL\n')),(0,a.kt)("p",null,"The following examples show typical matching functions:"),(0,a.kt)("p",null,"Match all SIP Messages."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},"req => true\n")),(0,a.kt)("p",null,"Match SIP Messages with a specific method."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},'req => req.method === "MESSAGE"\n')),(0,a.kt)("p",null,"Match SIP Messages with a specific method and a specific header."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},'req => req.method === "MESSAGE" && req.message.from.address.uri.user === "alice"\n')),(0,a.kt)("p",null,"Match SIP Messages with a specific ",(0,a.kt)("inlineCode",{parentName:"p"},"User-Agent")," header."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-javascript"},'req => req.message.extensions.find(e => e.name === "User-Agent" && e.value.includes("Zoiper"))\n')),(0,a.kt)("h2",{id:"communication-and-protobuf-spec"},"Communication and Protobuf Spec"),(0,a.kt)("p",null,"The Message Dispatcher uses gRPC to communicate with the Processors and Middlewares, which happen to share the protobuf definition:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-protobuf"},'syntax = "proto3";\n\npackage fonoster.routr.processor.v2beta1;\n\nimport "common.proto";\nimport "sipmessage.proto";\n\n// Processor service\nservice Processor {\n  // Process Message Request\n  rpc ProcessMessage (MessageRequest) returns (MessageResponse) {}\n}\n\nenum Method {\n  UNKNOWN = 0;\n  // Communicates user location (hostname, IP)\n  REGISTER = 1;\n  // Establishes a session\n  INVITE = 2;\n  // Transports Instant Messages\n  MESSAGE = 3;\n  // Publishes an event to the Server\n  PUBLISH = 4;\n  // Notifies the subscriber of a new event\n  NOTIFY = 5;\n  // Subscribes for Notification from the notifier\n  SUBSCRIBE = 6;\n  // Confirms an INVITE request\n  ACK = 7;\n  // Terminates a session\n  BYE = 8;\n  // Cancels establishing of a session\n  CANCEL = 9;\n  // Communicates information about the capabilities of the calling and receiving SIP phones\n  OPTIONS = 10;\n  // Provisional Acknowledgement\n  PRACK = 11;\n  // Sends mid-session information\n  INFO = 12;\n  // Asks the recipient to issue a call transfer\n  REFER = 13;\n  // Modifies the state of a session\n  UPDATE = 14;\n}\n\nmessage NetInterface {\n  string host = 1;\n  int32 port = 2;\n  fonoster.routr.common.v2beta1.Transport transport = 3;\n}\n\nmessage MessageRequest {\n  // Same as the Call-Id header \n  string ref = 1;\n  string edge_port_ref = 2;\n  Method method = 3;\n  NetInterface sender = 4;\n  repeated NetInterface listening_points = 5;\n  repeated string external_addrs = 6;\n  repeated string localnets = 7;\n  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 8;\n  map<string, string> metadata = 9;\n}\n\nmessage MessageResponse {\n  NetInterface sender = 1;\n  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 2;\n  map<string, string> metadata = 3;\n}\n')),(0,a.kt)("p",null,"Link to the ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/fonoster/routr/blob/main/mods/common/src/protos/processor.proto"},"protobuf definition.")),(0,a.kt)("h2",{id:"launching-the-dispatcher-with-docker"},"Launching the Dispatcher with Docker"),(0,a.kt)("p",null,"The Message Dispatcher is available as a Docker image from ",(0,a.kt)("a",{parentName:"p",href:"https://hub.docker.com/r/fonoster/routr-dispatcher"},"Docker Hub"),". To launch the Dispatcher with Docker, you can use the following command:"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-bash"},"docker run -it -v $(pwd)/dispatcher.yaml:/etc/routr/dispatcher.yaml -p 51901:51901 fonoster/routr-dispatcher\n")),(0,a.kt)("p",null,"The previous example will pull the latest version of the Dispatcher from Docker Hub and launch it with the default configuration. The Dispatcher will be listening on port ",(0,a.kt)("inlineCode",{parentName:"p"},"51901")," for gRPC requests. Remember, your Docker container must expose the ports in your configuration file. By default, the Dispatcher listens on port ",(0,a.kt)("inlineCode",{parentName:"p"},"51901"),"."),(0,a.kt)("h2",{id:"quick-test-with-grpcurl"},"Quick Test with gRPCurl"),(0,a.kt)("p",null,"For testing and development purposes, one easy way to interact with the Dispatcher is to use ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/fullstorydev/grpcurl"},"gRPCurl"),". The following example shows how to send a SIP Message to the Dispatcher."),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-bash"},"grpcurl -plaintext \\\n  -import-path /path/to/protos \\\n  -proto processor.proto  -d '{...}' \\\n  localhost:51901 \\\n  fonoster.routr.processor.v2beta1.Processor/ProcessMessage\n")))}m.isMDXComponent=!0}}]);