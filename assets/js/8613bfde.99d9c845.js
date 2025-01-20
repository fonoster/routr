"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[3296],{4781:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>a,default:()=>h,frontMatter:()=>l,metadata:()=>s,toc:()=>i});const s=JSON.parse('{"id":"connect/sending-call-events-to-nats","title":"Sending Call Events to NATS","description":"Routr ships with a NATS publisher that can be used to send call events to a NATS server. Call events are a function of the EdgePort. To enable the NATS publisher, you will need to update your EdgePort service to set the environment variable NATSPUBLISHERENABLED to true as well as the environment variable NATSPUBLISHERURL to the URL of your NATS server. For example:","source":"@site/docs/connect/sending-call-events-to-nats.md","sourceDirName":"connect","slug":"/connect/sending-call-events-to-nats","permalink":"/docs/2.11.5/connect/sending-call-events-to-nats","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr/edit/main/docs/docs/docs/connect/sending-call-events-to-nats.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Securing the Server","permalink":"/docs/2.11.5/connect/securing-the-server"},"next":{"title":"Community","permalink":"/docs/2.11.5/community"}}');var r=t(4848),o=t(8453);const l={},a="Sending Call Events to NATS",c={},i=[];function d(e){const n={a:"a",blockquote:"blockquote",code:"code",h1:"h1",header:"header",img:"img",li:"li",p:"p",pre:"pre",ul:"ul",...(0,o.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.header,{children:(0,r.jsx)(n.h1,{id:"sending-call-events-to-nats",children:"Sending Call Events to NATS"})}),"\n",(0,r.jsxs)(n.p,{children:["Routr ships with a NATS publisher that can be used to send call events to a NATS server. Call events are a function of the EdgePort. To enable the NATS publisher, you will need to update your EdgePort service to set the environment variable ",(0,r.jsx)(n.code,{children:"NATS_PUBLISHER_ENABLED"})," to ",(0,r.jsx)(n.code,{children:"true"})," as well as the environment variable ",(0,r.jsx)(n.code,{children:"NATS_PUBLISHER_URL"})," to the URL of your NATS server. For example:"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-yaml",children:'version: "3"\nservices:\n  routr:\n    image: fonoster/routr-one:latest\n    ports:\n      - 51908:51908\n      - 5060:5060/udp\n    environment:\n      - NATS_PUBLISHER_ENABLED=true\n      - NATS_PUBLISHER_URL=nats:4222\n'})}),"\n",(0,r.jsx)(n.p,{children:"Once you have enabled the NATS publisher, you can subscribe to the routr.call.started or routr.call.ended subjects to receive call events.\nAs of the writing of this book, only the routr.call.started and routr.call.ended subjects are supported. However, we plan to add more subjects in the future. Be sure to check in later to see if any more have been added."}),"\n",(0,r.jsx)(n.p,{children:"To begin receiving call events, you can use the nats sub command line tool. To do this, first connect to your NATS server by running the following command:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:'nats context add nats \\\n  --server demo.nats.io:4222 \\\n  --description "nats events" \\\n  --select\n'})}),"\n",(0,r.jsx)(n.p,{children:"You should then see something like this:"}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.img,{alt:"NATS context add",src:t(2774).A+"",width:"880",height:"430"})}),"\n",(0,r.jsxs)(n.p,{children:["In the previous command, we connected to the ",(0,r.jsx)(n.code,{children:"demo.nats.io"})," server, which is a public NATS server. You can use your own NATS server if you have one."]}),"\n",(0,r.jsxs)(n.p,{children:["Then, you can subscribe to the ",(0,r.jsx)(n.code,{children:"routr.call.started"})," subject by running the following command:"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"nats sub routr.call.started\n"})}),"\n",(0,r.jsxs)(n.p,{children:["The ",(0,r.jsx)(n.code,{children:"routr.call.started"})," event contains the following fields:"]}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"callId"}),": The unique identifier of the call"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"from"}),": The caller's phone number"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"to"}),": The callee's phone number"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"startTime"}),": The time the call started formatted as an ISO 8601 string"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"extraHeaders"}),": Any extra headers that were sent with the call"]}),"\n"]}),"\n",(0,r.jsxs)(n.p,{children:["Every header startarting with ",(0,r.jsx)(n.code,{children:"X-"})," is considered an extra header. For example, if you send a call with the following headers:"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"X-My-Header: my-value\nX-Another-Header: another-value\n"})}),"\n",(0,r.jsxs)(n.p,{children:["Then, the ",(0,r.jsx)(n.code,{children:"extraHeaders"})," field will contain the following:"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-json",children:'{\n  "X-My-Header": "my-value",\n  "X-Another-Header": "another-value"\n}\n'})}),"\n",(0,r.jsx)(n.p,{children:"After subscribing to the subject and making a call, you should see something like this:"}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.img,{alt:"NATS call started",src:t(2112).A+"",width:"880",height:"430"})}),"\n",(0,r.jsx)(n.p,{children:"Similarly, you can subscribe to the routr.call.ended subject to receive call-ended events."}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"nats sub routr.call.ended\n"})}),"\n",(0,r.jsxs)(n.p,{children:["The ",(0,r.jsx)(n.code,{children:"routr.call.ended"})," event contains the following fields:"]}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"callId"}),": The unique identifier of the call"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"endTime"}),": The time the call ended formatted as an ISO 8601 string"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"hangupCause"}),": The reason the call ended"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"extraHeaders"}),": Any extra headers that were sent with the call"]}),"\n"]}),"\n",(0,r.jsxs)(n.blockquote,{children:["\n",(0,r.jsxs)(n.p,{children:["Please see the ",(0,r.jsx)(n.a,{href:"https://github.com/fonoster/routr/blob/main/mods/edgeport/src/main/java/io/routr/HangupCauses.java",children:"HangupCause.java"})," class for a list of possible hangup causes."]}),"\n"]}),"\n",(0,r.jsxs)(n.p,{children:["Lastly, you can subscribe to the ",(0,r.jsx)(n.code,{children:"routr.endpoint.registered"})," subject to receive endpoint registered events."]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"nats sub routr.endpoint.registered\n"})}),"\n",(0,r.jsxs)(n.p,{children:["The ",(0,r.jsx)(n.code,{children:"routr.endpoint.registered"})," event contains the following fields:"]}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"aor"}),": The address of record of the endpoint"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"registeredAt"}),": The time the endpoint registered formatted as an ISO 8601 string"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"expires"}),": The time in seconds the endpoint will remain registered"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"extraHeaders"}),": Any extra headers that were sent with the call"]}),"\n"]}),"\n",(0,r.jsxs)(n.p,{children:["You can use the ",(0,r.jsx)(n.code,{children:"NATS_PUBLISHER_SUBJECT"})," environment variable to change the based subject name. For example, you can set it to ",(0,r.jsx)(n.code,{children:"myserver"})," to receive call events in the ",(0,r.jsx)(n.code,{children:"myserver.calls.started"})," subject."]})]})}function h(e={}){const{wrapper:n}={...(0,o.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(d,{...e})}):d(e)}},2774:(e,n,t)=>{t.d(n,{A:()=>s});const s=t.p+"assets/images/nats-context-add-nats-7fe6194a7f1fbc08702107ea126c85fd.png"},2112:(e,n,t)=>{t.d(n,{A:()=>s});const s=t.p+"assets/images/nats-sub-routr-call-started-c75ef439e4a47b8697930de27b57552b.png"},8453:(e,n,t)=>{t.d(n,{R:()=>l,x:()=>a});var s=t(6540);const r={},o=s.createContext(r);function l(e){const n=s.useContext(o);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),s.createElement(o.Provider,{value:n},e.children)}}}]);