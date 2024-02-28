"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[7063],{577:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>a,contentTitle:()=>c,default:()=>h,frontMatter:()=>n,metadata:()=>s,toc:()=>d});var i=r(4848),o=r(8453);const n={},c="Architecture",s={id:"overview/architecture",title:"Architecture",description:"Routr's architecture diagram",source:"@site/docs/overview/architecture.md",sourceDirName:"overview",slug:"/overview/architecture",permalink:"/docs/2.0.0/overview/architecture",draft:!1,unlisted:!1,editUrl:"https://github.com/fonoster/routr-website/edit/main/docs/overview/architecture.md",tags:[],version:"current",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"Introduction",permalink:"/docs/2.0.0/overview/introduction"},next:{title:"Concepts",permalink:"/docs/2.0.0/overview/concepts"}},a={},d=[];function u(e){const t={a:"a",h1:"h1",img:"img",li:"li",p:"p",ul:"ul",...(0,o.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.h1,{id:"architecture",children:"Architecture"}),"\n",(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"Routr&#39;s architecture diagram",src:r(5763).A+"",width:"1221",height:"491"})}),"\n",(0,i.jsx)(t.h1,{id:"summary",children:"Summary"}),"\n",(0,i.jsx)(t.p,{children:"Routr takes a radically different approach to SIP servers. Instead of using a monolithic architecture, Routr comprises a set of loosely coupled services that communicate with each other using gRPC. This approach allows Routr to be easily extended, customized, and scaled."}),"\n",(0,i.jsx)(t.h1,{id:"specification",children:"Specification"}),"\n",(0,i.jsx)(t.p,{children:"With Routr v2, we introduced a set of specifications describing each service's behavior. The specifications are the following:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsx)(t.li,{children:(0,i.jsx)(t.a,{href:"https://github.com/fonoster/routr/blob/master/docs/specs/CORE.md",children:"Core Specification"})}),"\n",(0,i.jsx)(t.li,{children:(0,i.jsx)(t.a,{href:"https://github.com/fonoster/routr/blob/master/docs/specs/CONNECT.md",children:"Connect Specification"})}),"\n"]}),"\n",(0,i.jsx)(t.p,{children:"The Core specification describes the core components and their behavior. It explains how to transform SIP messages into protocol buffers and how to handle SIP routing."}),"\n",(0,i.jsx)(t.p,{children:"The Connect specification describes how Routr implements the SIP Connect specification. It explains how to handle SIP routing for Agents, Peers, Trunks, Numbers, ACL, and more."}),"\n",(0,i.jsx)(t.p,{children:"Most users will not need to read the specifications. However, if you want to extend Routr's functionality, we recommend you read them."})]})}function h(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(u,{...e})}):u(e)}},5763:(e,t,r)=>{r.d(t,{A:()=>i});const i=r.p+"assets/images/architecture_v2-d563de2e0748455c8332bf19f5e68090.png"},8453:(e,t,r)=>{r.d(t,{R:()=>c,x:()=>s});var i=r(6540);const o={},n=i.createContext(o);function c(e){const t=i.useContext(n);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function s(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(o):e.components||o:c(e.components),i.createElement(n.Provider,{value:t},e.children)}}}]);