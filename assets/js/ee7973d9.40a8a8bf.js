"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[2514],{498:(e,s,r)=>{r.r(s),r.d(s,{assets:()=>o,contentTitle:()=>c,default:()=>h,frontMatter:()=>d,metadata:()=>n,toc:()=>a});const n=JSON.parse('{"id":"configuration/peers","title":"Peers","description":"Like Agents, Peers represent SIP endpoints such as Media Servers.","source":"@site/versioned_docs/version-1.x.x/configuration/peers.md","sourceDirName":"configuration","slug":"/configuration/peers","permalink":"/docs/1.x.x/configuration/peers","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-1.x.x/configuration/peers.md","tags":[],"version":"1.x.x","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Numbers","permalink":"/docs/1.x.x/configuration/numbers"},"next":{"title":"Users","permalink":"/docs/1.x.x/configuration/users"}}');var t=r(4848),i=r(8453);const d={},c="Peers",o={},a=[{value:"Peer Resource",id:"peer-resource",level:2},{value:"Example",id:"example",level:2}];function l(e){const s={blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",header:"header",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,i.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(s.header,{children:(0,t.jsx)(s.h1,{id:"peers",children:"Peers"})}),"\n",(0,t.jsx)(s.p,{children:"Like Agents, Peers represent SIP endpoints such as Media Servers."}),"\n",(0,t.jsx)(s.p,{children:"Unlike Agents, Peers aren't bound by a Domain."}),"\n",(0,t.jsxs)(s.p,{children:["The Peers configuration can be provided using the file ",(0,t.jsx)(s.code,{children:"config/peers.yml"})," located at the root of your Routr installation."]}),"\n",(0,t.jsxs)(s.blockquote,{children:["\n",(0,t.jsx)(s.p,{children:"If using Redis this configuration gets stored in the database."}),"\n"]}),"\n",(0,t.jsx)(s.h2,{id:"peer-resource",children:"Peer Resource"}),"\n",(0,t.jsxs)(s.table,{children:[(0,t.jsx)(s.thead,{children:(0,t.jsxs)(s.tr,{children:[(0,t.jsx)(s.th,{children:"Property"}),(0,t.jsx)(s.th,{children:"Description"}),(0,t.jsx)(s.th,{children:"Required"})]})}),(0,t.jsxs)(s.tbody,{children:[(0,t.jsxs)(s.tr,{children:[(0,t.jsx)(s.td,{children:"apiVersion"}),(0,t.jsx)(s.td,{children:"Indicates the version of the resource (Not yet implemented)"}),(0,t.jsx)(s.td,{children:"Yes"})]}),(0,t.jsxs)(s.tr,{children:[(0,t.jsx)(s.td,{children:"kind"}),(0,t.jsx)(s.td,{children:"Defines the type of resource"}),(0,t.jsx)(s.td,{children:"Yes"})]}),(0,t.jsxs)(s.tr,{children:[(0,t.jsx)(s.td,{children:"metadata.name"}),(0,t.jsx)(s.td,{children:"Friendly name for the SIP device"}),(0,t.jsx)(s.td,{children:"Yes"})]}),(0,t.jsxs)(s.tr,{children:[(0,t.jsx)(s.td,{children:"spec.credentials.username"}),(0,t.jsx)(s.td,{children:"Peer's credential username"}),(0,t.jsx)(s.td,{children:"Yes"})]}),(0,t.jsxs)(s.tr,{children:[(0,t.jsx)(s.td,{children:"spec.credentials.secret"}),(0,t.jsx)(s.td,{children:"Peer's credential secret"}),(0,t.jsx)(s.td,{children:"Yes"})]}),(0,t.jsxs)(s.tr,{children:[(0,t.jsx)(s.td,{children:"spec.device"}),(0,t.jsx)(s.td,{children:"When set it is used by the location service"}),(0,t.jsx)(s.td,{children:"No"})]}),(0,t.jsxs)(s.tr,{children:[(0,t.jsx)(s.td,{children:"spec.contactAddr"}),(0,t.jsx)(s.td,{children:"When set advertises this as the contactURI"}),(0,t.jsx)(s.td,{children:"No"})]})]})]}),"\n",(0,t.jsx)(s.h2,{id:"example",children:"Example"}),"\n",(0,t.jsx)(s.pre,{children:(0,t.jsx)(s.code,{className:"language-yaml",children:"- apiVersion: v1beta1\n  kind: Peer\n  metadata:\n    name: Asterisk (Media Server)\n  spec:\n    credentials:\n      username: ast\n      secret: 'astsecret'\n    device: astserver      # If is not define the IP address will be used\n    contactAddr: '192.168.1.2:6060'\n"})}),"\n",(0,t.jsxs)(s.blockquote,{children:["\n",(0,t.jsxs)(s.p,{children:["This peer can be reached using the AOR: ",(0,t.jsx)(s.code,{children:"ast@astserver"}),"."]}),"\n"]})]})}function h(e={}){const{wrapper:s}={...(0,i.R)(),...e.components};return s?(0,t.jsx)(s,{...e,children:(0,t.jsx)(l,{...e})}):l(e)}},8453:(e,s,r)=>{r.d(s,{R:()=>d,x:()=>c});var n=r(6540);const t={},i=n.createContext(t);function d(e){const s=n.useContext(i);return n.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function c(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:d(e.components),n.createElement(i.Provider,{value:s},e.children)}}}]);