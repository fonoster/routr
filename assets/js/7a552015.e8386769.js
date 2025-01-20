"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[2913],{5795:(e,t,s)=>{s.r(t),s.d(t,{assets:()=>c,contentTitle:()=>i,default:()=>a,frontMatter:()=>d,metadata:()=>r,toc:()=>l});const r=JSON.parse('{"id":"development/components/edgeport","title":"EdgePort","description":"The EdgePort component accepts SIP Messages, parses them into protobuf, and sends them to the Message Dispatcher. After a SIP Message is processed, the EdgePort will forward the SIP Message to the next hop.","source":"@site/versioned_docs/version-2.0.0/development/components/edgeport.md","sourceDirName":"development/components","slug":"/development/components/edgeport","permalink":"/docs/2.0.0/development/components/edgeport","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr/edit/main/docs/docs/versioned_docs/version-2.0.0/development/components/edgeport.md","tags":[],"version":"2.0.0","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Overview","permalink":"/docs/2.0.0/development/components/overview"},"next":{"title":"Message Dispatcher","permalink":"/docs/2.0.0/development/components/dispatcher"}}');var n=s(4848),o=s(8453);const d={},i="EdgePort",c={},l=[{value:"Configuration Spec",id:"configuration-spec",level:2},{value:"Communication and Protobuf Spec",id:"communication-and-protobuf-spec",level:2},{value:"Launching the EdgePort with Docker",id:"launching-the-edgeport-with-docker",level:2}];function h(e){const t={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,o.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(t.header,{children:(0,n.jsx)(t.h1,{id:"edgeport",children:"EdgePort"})}),"\n",(0,n.jsx)(t.p,{children:"The EdgePort component accepts SIP Messages, parses them into protobuf, and sends them to the Message Dispatcher. After a SIP Message is processed, the EdgePort will forward the SIP Message to the next hop."}),"\n",(0,n.jsx)(t.p,{children:"The following diagram shows the relation between a SIP client, the EdgePort, and the Dispatcher."}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-text",children:"\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510 \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502SIP Client\u2502  \u2502EdgePort\u2502 \u2502Message Dispatcher\u2502\n\u2514\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2518 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n     \u2502            \u2502             \u2502        \n     \u2502SIP request \u2502             \u2502        \n     \u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500>\u2502             \u2502        \n     \u2502            \u2502             \u2502        \n     \u2502            \u2502gRPC request \u2502        \n     \u2502            \u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500>\u2502        \n     \u2502            \u2502             \u2502        \n     \u2502            \u2502gRPC response\u2502        \n     \u2502            \u2502<\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502        \n     \u2502            \u2502             \u2502        \n     \u2502SIP response\u2502             \u2502        \n     \u2502<\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502             \u2502        \n\u250c\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2510  \u250c\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2510 \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502SIP Client\u2502  \u2502EdgePort\u2502 \u2502Message Dispatcher\u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n"})}),"\n",(0,n.jsx)(t.p,{children:"While we show the Dispatcher, we could also use a Processor. Both components share the same protobuf. However, the Dispatcher is required when you expect multiple Processors or at least one Middleware."}),"\n",(0,n.jsx)(t.p,{children:"For example, if your use case requires having one Processor for SIP INVITE and another for SIP MESSAGE requests, you will need to use a Dispatcher. Similarly, if you want to use a Middleware, you will need to use a Dispatcher."}),"\n",(0,n.jsx)(t.p,{children:"If you only have one Processor and have not Middleware, you can use the Processor directly. Running the Processor directly will make your deployment simpler and faster."}),"\n",(0,n.jsx)(t.h2,{id:"configuration-spec",children:"Configuration Spec"}),"\n",(0,n.jsx)(t.p,{children:"To configure the EdgePort, you must provide a YAML or JSON configuration with the following structure."}),"\n",(0,n.jsxs)(t.table,{children:[(0,n.jsx)(t.thead,{children:(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.th,{children:"Property"}),(0,n.jsx)(t.th,{children:"Description"}),(0,n.jsx)(t.th,{children:"Required"})]})}),(0,n.jsxs)(t.tbody,{children:[(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"ref"})}),(0,n.jsx)(t.td,{children:"Reference to the EdgePort"}),(0,n.jsx)(t.td,{children:"Yes"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"metadata.region"})}),(0,n.jsx)(t.td,{children:"Region where the EdgePort is located (reserved for future use)"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.unknownMethodAction"})}),(0,n.jsx)(t.td,{children:"What to do if an incoming request type is not allowed (reserved for future use)"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.transport"})}),(0,n.jsx)(t.td,{children:"Enabled Transport Protocols"}),(0,n.jsx)(t.td,{children:"Yes"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.transport[*].protocol"})}),(0,n.jsx)(t.td,{children:"Transport protocol"}),(0,n.jsx)(t.td,{children:"Yes"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.transport[*].bindAddr"})}),(0,n.jsx)(t.td,{children:"Ipv4 interface to accept requests on"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.transport[*].port"})}),(0,n.jsx)(t.td,{children:"Port to listen on"}),(0,n.jsx)(t.td,{children:"Yes"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.methods"})}),(0,n.jsx)(t.td,{children:"Acceptable SIP Methods"}),(0,n.jsx)(t.td,{children:"Yes"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.processor"})}),(0,n.jsx)(t.td,{children:"Adjacent service for message routing"}),(0,n.jsx)(t.td,{children:"Yes"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.processor.addr"})}),(0,n.jsx)(t.td,{children:"Address of the adjacent service"}),(0,n.jsx)(t.td,{children:"Yes"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.localnets"})}),(0,n.jsx)(t.td,{children:"Networks considered to be in the same local network"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.externalAddrs"})}),(0,n.jsx)(t.td,{children:"EdgePort external ip addresses"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.bindAddr"})}),(0,n.jsx)(t.td,{children:"Ipv4 interface to accept requests on"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.securityContext"})}),(0,n.jsx)(t.td,{children:"Security context"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.securityContext.client"})}),(0,n.jsx)(t.td,{children:"Client security context"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.securityContext.client.protocols"})}),(0,n.jsx)(t.td,{children:"TLS protocols used by the client (e.g., SSLv3, TLSv1.2)"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.securityContext.client.authType"})}),(0,n.jsx)(t.td,{children:"Client authentication type (e.g., Disabled, DisabledAll, Required, Wanted)"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.securityContext.keyStore"})}),(0,n.jsx)(t.td,{children:"Path to the key store file"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.securityContext.trustStore"})}),(0,n.jsx)(t.td,{children:"Path to the trust store file"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.securityContext.keyStorePassword"})}),(0,n.jsx)(t.td,{children:"Password for the key store"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.securityContext.trustStorePassword"})}),(0,n.jsx)(t.td,{children:"Password for the trust store"}),(0,n.jsx)(t.td,{children:"No"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:(0,n.jsx)(t.code,{children:"spec.securityContext.keyStoreType"})}),(0,n.jsx)(t.td,{children:"Type of the key store (e.g., pkcs12)"}),(0,n.jsx)(t.td,{children:"No"})]})]})]}),"\n",(0,n.jsxs)(t.p,{children:["The security context is required if the EdgePort is configured to use a secure protocol such as ",(0,n.jsx)(t.code,{children:"TLS"})," or ",(0,n.jsx)(t.code,{children:"WSS"}),"."]}),"\n",(0,n.jsxs)(t.blockquote,{children:["\n",(0,n.jsxs)(t.p,{children:["Please see JAINSIP docs for details on the security context ",(0,n.jsx)(t.a,{href:"https://javadoc.io/doc/javax.sip/jain-sip-ri/1.2.220/gov/nist/javax/sip/SipStackImpl.html",children:"properties."})]}),"\n"]}),"\n",(0,n.jsx)(t.p,{children:"Here is an example of a configuration file:"}),"\n",(0,n.jsxs)(t.p,{children:["Filename: ",(0,n.jsx)(t.code,{children:"dispatcher.yaml"})," or ",(0,n.jsx)(t.code,{children:"dispatcher.json"})]}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-yaml",children:'kind: EdgePort\napiVersion: v2beta1\nref: edgeport-01\nmetadata:\n  region: default\nspec:\n  unknownMethodAction: Discard\n  processor:\n    addr: dispatcher:51901  \n  securityContext:\n    client:\n      protocols:\n        - SSLv3\n        - TLSv1.2\n      authType: DisabledAll\n    keyStorePassword: changeme\n    trustStorePassword: changeme\n    keyStore: "/etc/routr/certs/signaling.p12"\n    trustStore: "/etc/routr/certs/signaling.p12"\n    keyStoreType: pkcs12\n  externalAddrs:\n    - 10.111.220.2\n    - sip01.edgeport.net\n  localnets:\n    - 127.0.0.1/8\n    - 10.111.221.2/24\n  methods:\n    - REGISTER\n    - MESSAGE\n    - INVITE\n    - ACK\n    - BYE\n    - CANCEL\n  transport:\n    - protocol: tcp\n      port: 5060\n    - protocol: udp\n      port: 5060\n    - protocol: tls\n      port: 5061\n    - protocol: ws \n      port: 5062\n    - protocol: wss\n      port: 5063\n'})}),"\n",(0,n.jsxs)(t.p,{children:["The EdgePort requires the ",(0,n.jsx)(t.code,{children:"spec.externalAddrs"})," field to function properly in NATed environments like Docker. When provided, the ",(0,n.jsx)(t.code,{children:"spec.externalAddrs"})," is added as metadata to the SIP message and can later be used by a Processor to determine the correct advertised address."]}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.strong,{children:"Environment Variables"})}),"\n",(0,n.jsx)(t.p,{children:"The EdgePort provides the following environment variables as a convenient way to overwrite some configuration properties or provide additional behavior not covered by the configuration spec."}),"\n",(0,n.jsxs)(t.ul,{children:["\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"PROCESSOR_ADDR"})," - Overwrites the ",(0,n.jsx)(t.code,{children:"spec.processor.addr"})," property"]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"HOSTNAME"})," - Overwrites the ",(0,n.jsx)(t.code,{children:"ref"})," property. If running in K8s, ",(0,n.jsx)(t.code,{children:"ref"})," will be set to the pod's hostname."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"IGNORE_LOOPBACK_FROM_LOCALNETS"})," - If set to ",(0,n.jsx)(t.code,{children:"true"}),", the EdgePort will ignore the loopback address from the ",(0,n.jsx)(t.code,{children:"localnets"})," property. In Docker deployments, this is set to ",(0,n.jsx)(t.code,{children:"true"})," by default."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"CONSOLE_PUBLISHER_ENABLED"})," - If set to ",(0,n.jsx)(t.code,{children:"true"}),", the EdgePort will publish SIP messages to the console publisher. Useful for debugging purposes."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"NATS_PUBLISHER_ENABLED"})," - If set to ",(0,n.jsx)(t.code,{children:"true"}),", the EdgePort will publish SIP messages to the NATS publisher."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"NATS_PUBLISHER_SUBJECT"})," - Overwrites the default subject the NATS publisher uses. The default subject is ",(0,n.jsx)(t.code,{children:"routr"}),"."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"NATS_PUBLISHER_URL"})," - This is required if ",(0,n.jsx)(t.code,{children:"NATS_PUBLISHER_ENABLED"})," is set to ",(0,n.jsx)(t.code,{children:"true"}),". It should contain the NATS server URL. For example: ",(0,n.jsx)(t.code,{children:"nats://nats:4222"}),"."]}),"\n"]}),"\n",(0,n.jsx)(t.h2,{id:"communication-and-protobuf-spec",children:"Communication and Protobuf Spec"}),"\n",(0,n.jsx)(t.p,{children:"While the entry point to the EdgePort is SIP, the communication with downstream services happens via gRPC. The EdgePort uses the following protobuf messages to communicate with the Dispatcher or Processor, which shares the protobuf definition."}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-protobuf",children:'syntax = "proto3";\n\npackage fonoster.routr.processor.v2beta1;\n\nimport "common.proto";\nimport "sipmessage.proto";\n\n// Processor service\nservice Processor {\n  // Process Message Request\n  rpc ProcessMessage (MessageRequest) returns (MessageResponse) {}\n}\n\nenum Method {\n  UNKNOWN = 0;\n  // Communicates user location (hostname, IP)\n  REGISTER = 1;\n  // Establishes a session\n  INVITE = 2;\n  // Transports Instant Messages\n  MESSAGE = 3;\n  // Publishes an event to the Server\n  PUBLISH = 4;\n  // Notifies the subscriber of a new event\n  NOTIFY = 5;\n  // Subscribes for Notification from the notifier\n  SUBSCRIBE = 6;\n  // Confirms an INVITE request\n  ACK = 7;\n  // Terminates a session\n  BYE = 8;\n  // Cancels establishing of a session\n  CANCEL = 9;\n  // Communicates information about the capabilities of the calling and receiving SIP phones\n  OPTIONS = 10;\n  // Provisional Acknowledgement\n  PRACK = 11;\n  // Sends mid session information\n  INFO = 12;\n  // Asks the recipient to issue call transfer\n  REFER = 13;\n  // Modifies the state of a session\n  UPDATE = 14;\n}\n\nmessage NetInterface {\n  string host = 1;\n  int32 port = 2;\n  fonoster.routr.common.v2beta1.Transport transport = 3;\n}\n\nmessage MessageRequest {\n  // Same as the Call-Id header \n  string ref = 1;\n  string edge_port_ref = 2;\n  Method method = 3;\n  NetInterface sender = 4;\n  repeated NetInterface listening_points = 5;\n  repeated string external_addrs = 6;\n  repeated string localnets = 7;\n  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 8;\n  map<string, string> metadata = 9;\n}\n\nmessage MessageResponse {\n  NetInterface sender = 1;\n  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 2;\n  map<string, string> metadata = 3;\n}\n'})}),"\n",(0,n.jsxs)(t.p,{children:["Link to the ",(0,n.jsx)(t.a,{href:"https://github.com/fonoster/routr/blob/main/mods/common/src/protos/processor.proto",children:"protobuf definition."})]}),"\n",(0,n.jsx)(t.h2,{id:"launching-the-edgeport-with-docker",children:"Launching the EdgePort with Docker"}),"\n",(0,n.jsxs)(t.p,{children:["The EdgePort is available as a Docker image from ",(0,n.jsx)(t.a,{href:"https://hub.docker.com/r/fonoster/routr-edgeport",children:"Docker Hub"}),". To launch the EdgePort with Docker, you can use the following command:"]}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-bash",children:"docker run -it -v $(pwd)/edgeport.yaml:/etc/routr/edgeport.yaml -p 5060:5060/udp fonoster/routr-edgeport\n"})}),"\n",(0,n.jsxs)(t.p,{children:["The previous example will pull the latest version of the EdgePort from Docker Hub and launch it with the default configuration. The EdgePort will be listening on port ",(0,n.jsx)(t.code,{children:"5060"})," for UDP traffic. Remember, your Docker container must expose the ports in your configuration file. For example, if you want the port ",(0,n.jsx)(t.code,{children:"5061"})," for TLS traffic, you must add the following flag to the ",(0,n.jsx)(t.code,{children:"docker run"})," command: ",(0,n.jsx)(t.code,{children:"-p 5061:5061"}),"."]})]})}function a(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(h,{...e})}):h(e)}},8453:(e,t,s)=>{s.d(t,{R:()=>d,x:()=>i});var r=s(6540);const n={},o=r.createContext(n);function d(e){const t=r.useContext(o);return r.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function i(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:d(e.components),r.createElement(o.Provider,{value:t},e.children)}}}]);