"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[2512],{517:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>a,contentTitle:()=>c,default:()=>h,frontMatter:()=>i,metadata:()=>r,toc:()=>u});const r=JSON.parse('{"id":"development/components/requester","title":"Requester","description":"The Requester service is an optional service used when you want to reach an EdgePort using gRPC instead of SIP. As of the release of this publication, we only use this component when the network needs a Registry Service. However, this may change in the future, so be sure to check in to see if there are any other potential uses.","source":"@site/versioned_docs/version-2.0.0/development/components/requester.md","sourceDirName":"development/components","slug":"/development/components/requester","permalink":"/docs/2.0.0/development/components/requester","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr/edit/main/docs/docs/versioned_docs/version-2.0.0/development/components/requester.md","tags":[],"version":"2.0.0","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Registry Service","permalink":"/docs/2.0.0/development/components/registry"},"next":{"title":"RTPRelay","permalink":"/docs/2.0.0/development/components/rtprelay"}}');var o=n(4848),s=n(8453);const i={},c="Requester",a={},u=[{value:"Configuration Spec",id:"configuration-spec",level:2},{value:"Communication and Protobuf Spec",id:"communication-and-protobuf-spec",level:2},{value:"Launching the Requester with Docker",id:"launching-the-requester-with-docker",level:2},{value:"Quick Test with gRPCurl",id:"quick-test-with-grpcurl",level:2}];function l(e){const t={a:"a",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",pre:"pre",ul:"ul",...(0,s.R)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(t.header,{children:(0,o.jsx)(t.h1,{id:"requester",children:"Requester"})}),"\n",(0,o.jsx)(t.p,{children:"The Requester service is an optional service used when you want to reach an EdgePort using gRPC instead of SIP. As of the release of this publication, we only use this component when the network needs a Registry Service. However, this may change in the future, so be sure to check in to see if there are any other potential uses."}),"\n",(0,o.jsx)(t.h2,{id:"configuration-spec",children:"Configuration Spec"}),"\n",(0,o.jsx)(t.p,{children:"The Requester service does not have a configuration file. However the following environment variables are available:"}),"\n",(0,o.jsxs)(t.ul,{children:["\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.code,{children:"BIND_ADDR"})," - Address to bind the service (Defaults to ",(0,o.jsx)(t.code,{children:"0.0.0.0:51909"}),")"]}),"\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.code,{children:"ENABLE_HEALTHCHECKS"})," - Enable health checks (Defaults to ",(0,o.jsx)(t.code,{children:"true"}),")"]}),"\n"]}),"\n",(0,o.jsx)(t.h2,{id:"communication-and-protobuf-spec",children:"Communication and Protobuf Spec"}),"\n",(0,o.jsx)(t.p,{children:"Services communicate with the Requester service using gRPC. The Requester, in turn, communicates with the EdgePort using SIP. The contract for communication with the Requester service is defined in the following protobuf:"}),"\n",(0,o.jsx)(t.pre,{children:(0,o.jsx)(t.code,{className:"language-protobuf",children:'syntax = "proto3";\n\npackage fonoster.routr.requester.v2beta1;\n\nimport "common.proto";\nimport "sipmessage.proto";\nimport "processor.proto";\n\n// Requester service\nservice Requester {\n  // Send Message Request\n  rpc SendMessage (SendMessageRequest) returns (SendMessageResponse) {}\n}\n\nmessage SendMessageRequest {\n  string target = 1;\n  fonoster.routr.processor.v2beta1.Method method = 2;\n  fonoster.routr.common.v2beta1.Transport transport = 3;\n  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 4;\n}\n\nmessage SendMessageResponse {\n  fonoster.routr.sipmessage.v2beta1.SIPMessage message = 1;\n}\n'})}),"\n",(0,o.jsxs)(t.p,{children:["Link to the ",(0,o.jsx)(t.a,{href:"https://github.com/fonoster/routr/blob/main/mods/common/src/protos/requester.proto",children:"protobuf definition."})]}),"\n",(0,o.jsx)(t.h2,{id:"launching-the-requester-with-docker",children:"Launching the Requester with Docker"}),"\n",(0,o.jsxs)(t.p,{children:["The Requester is available as a Docker image from ",(0,o.jsx)(t.a,{href:"https://hub.docker.com/r/fonoster/routr-requester",children:"Docker Hub"}),". To launch the Requester with Docker, you can use the following command:"]}),"\n",(0,o.jsx)(t.pre,{children:(0,o.jsx)(t.code,{className:"language-bash",children:"docker run -it -p 51909:51909 fonoster/routr-requester\n"})}),"\n",(0,o.jsxs)(t.p,{children:["The previous example will pull the latest version of the Requester from Docker Hub and launch it with the default configuration. The Requester will listen to port ",(0,o.jsx)(t.code,{children:"51909"})," for gRPC requests. Remember, your Docker container must expose the ports in your configuration file. By default, the Requester listens on port ",(0,o.jsx)(t.code,{children:"51909"}),"."]}),"\n",(0,o.jsx)(t.h2,{id:"quick-test-with-grpcurl",children:"Quick Test with gRPCurl"}),"\n",(0,o.jsxs)(t.p,{children:["One easy way to interact with the Requester for testing and development is to use ",(0,o.jsx)(t.a,{href:"https://github.com/fullstorydev/grpcurl",children:"gRPCurl"}),". The following example shows how to send a request to the Requester using gRPCurl:"]}),"\n",(0,o.jsx)(t.pre,{children:(0,o.jsx)(t.code,{className:"language-bash",children:"grpcurl -plaintext \\\n  -import-path /path/to/protos \\\n  -proto requester.proto  -d '{...}' \\\n  localhost:51909 \\\n  fonoster.routr.requester.v2beta1.Requester/SendMessage\n"})})]})}function h(e={}){const{wrapper:t}={...(0,s.R)(),...e.components};return t?(0,o.jsx)(t,{...e,children:(0,o.jsx)(l,{...e})}):l(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>i,x:()=>c});var r=n(6540);const o={},s=r.createContext(o);function i(e){const t=r.useContext(s);return r.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function c(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(o):e.components||o:i(e.components),r.createElement(s.Provider,{value:t},e.children)}}}]);