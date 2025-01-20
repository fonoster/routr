"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[1080],{8297:(t,e,s)=>{s.r(e),s.d(e,{assets:()=>c,contentTitle:()=>d,default:()=>o,frontMatter:()=>r,metadata:()=>n,toc:()=>x});const n=JSON.parse('{"id":"introduction/test-plan","title":"Test Plan","description":"DUT and Endpoints Configuration","source":"@site/versioned_docs/version-1.x.x/introduction/test-plan.md","sourceDirName":"introduction","slug":"/introduction/test-plan","permalink":"/docs/1.x.x/introduction/test-plan","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr/edit/main/docs/docs/versioned_docs/version-1.x.x/introduction/test-plan.md","tags":[],"version":"1.x.x","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Routr 1.0RC3 - User Location Lookup Performance Tests","permalink":"/docs/1.x.x/introduction/performance-tests/user-location"},"next":{"title":"Concepts","permalink":"/docs/1.x.x/concepts"}}');var i=s(4848),l=s(8453);const r={},d="Test Plan",c={},x=[{value:"DUT and Endpoints Configuration",id:"dut-and-endpoints-configuration",level:2},{value:"Test Case Summary",id:"test-case-summary",level:2},{value:"Test Cases",id:"test-cases",level:2},{value:"Test Case 1.1.1: Registration Setup",id:"test-case-111-registration-setup",level:3}];function h(t){const e={code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,l.R)(),...t.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(e.header,{children:(0,i.jsx)(e.h1,{id:"test-plan",children:"Test Plan"})}),"\n",(0,i.jsx)(e.h2,{id:"dut-and-endpoints-configuration",children:"DUT and Endpoints Configuration"}),"\n",(0,i.jsxs)(e.ul,{children:["\n",(0,i.jsx)(e.li,{children:"Routr has a Gateway resource configured to use TCP transport."}),"\n",(0,i.jsx)(e.li,{children:"The Gateway resource is configured with a range of E.164 numbers."}),"\n",(0,i.jsx)(e.li,{children:"Routr is configured to support Registration mode."}),"\n",(0,i.jsxs)(e.li,{children:["A Domain named ",(0,i.jsx)(e.code,{children:"sip.local"})," exist with Agents ",(0,i.jsx)(e.code,{children:"1001@sip.local"})," and ",(0,i.jsx)(e.code,{children:"1002@sip.local"})]}),"\n",(0,i.jsx)(e.li,{children:"The Gateway is capable of handling RFC6140 registrations"}),"\n"]}),"\n",(0,i.jsx)(e.h2,{id:"test-case-summary",children:"Test Case Summary"}),"\n",(0,i.jsxs)(e.table,{children:[(0,i.jsx)(e.thead,{children:(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.th,{children:"Test Case ID"}),(0,i.jsx)(e.th,{style:{textAlign:"left"},children:"Title"}),(0,i.jsx)(e.th,{style:{textAlign:"right"},children:"Required"})]})}),(0,i.jsxs)(e.tbody,{children:[(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.1.1"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Registration Setup"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.1.2"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Registration Failure"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.1.3"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Maintaining Registration"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.1.4"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Authentication"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.1.5"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"TLS Server Mode"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"No"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.2.1"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"DNS Lookup"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.2.2"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Static Mode Failure Detection"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"No"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.2.3"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"TLS Authentication"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"No"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.2.4"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"TLS Certificate Validation"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"No"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.3.1"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Intra-Domain Routing   / Successful Invite Setup"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.3.2"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Intra-Domain Routing   / Invite Rejected by Callee"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.3.3"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Intra-Domain Routing   / Invite Cancelled by Caller"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.3.4"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Intra-Domain Routing   / Invite Cancelled by Callee"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.4.1"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Domain-Ingress Routing / Successful Invite Setup"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.4.2"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Domain-Ingress Routing / Invite Rejected by Callee"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.4.3"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Domain-Ingress Routing / Invite Cancelled by Caller"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.4.4"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Domain-Ingress Routing / Invite Cancelled by Callee"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.5.1"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Domain-Egress Routing  / Successful Invite Setup"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.5.2"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Domain-Egress Routing  / Invite Rejected by Callee"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.5.3"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Domain-Egress Routing  / Invite Cancelled by Caller"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.5.4"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Domain-Egress Routing  / Invite Cancelled by Callee"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"1.6.1"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Peer-Egress Routing    / Successful Invite Setup"}),(0,i.jsx)(e.td,{style:{textAlign:"right"},children:"Yes"})]})]})]}),"\n",(0,i.jsx)(e.h2,{id:"test-cases",children:"Test Cases"}),"\n",(0,i.jsx)(e.h3,{id:"test-case-111-registration-setup",children:"Test Case 1.1.1: Registration Setup"}),"\n",(0,i.jsxs)(e.p,{children:[(0,i.jsx)(e.em,{children:"Objective"}),": This section tests the registration compatibility between Routr and the SIP Trunk provider. If the SIP Trunk provider under testing is IP-based, this section can be skipped."]}),"\n",(0,i.jsxs)(e.p,{children:[(0,i.jsx)(e.em,{children:"Procedure"}),":"]}),"\n",(0,i.jsxs)(e.table,{children:[(0,i.jsx)(e.thead,{children:(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.th,{}),(0,i.jsx)(e.th,{style:{textAlign:"left"},children:"Description"}),(0,i.jsx)(e.th,{style:{textAlign:"left"},children:"Expected Result"})]})}),(0,i.jsxs)(e.tbody,{children:[(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"Step 1"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Restart Routr to send a REGISTER message to the Gateway"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Routr restarts"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"Step 2"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Wait for the server to restart"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"UAS receives correct registration sequence"})]}),(0,i.jsxs)(e.tr,{children:[(0,i.jsx)(e.td,{children:"Step 3"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Clear the registration table"}),(0,i.jsx)(e.td,{style:{textAlign:"left"},children:"Registry table is empty"})]})]})]})]})}function o(t={}){const{wrapper:e}={...(0,l.R)(),...t.components};return e?(0,i.jsx)(e,{...t,children:(0,i.jsx)(h,{...t})}):h(t)}},8453:(t,e,s)=>{s.d(e,{R:()=>r,x:()=>d});var n=s(6540);const i={},l=n.createContext(i);function r(t){const e=n.useContext(l);return n.useMemo((function(){return"function"==typeof t?t(e):{...e,...t}}),[e,t])}function d(t){let e;return e=t.disableParentContext?"function"==typeof t.components?t.components(i):t.components||i:r(t.components),n.createElement(l.Provider,{value:e},t.children)}}}]);