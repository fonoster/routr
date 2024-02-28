"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[9583],{4053:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>o,default:()=>h,frontMatter:()=>r,metadata:()=>d,toc:()=>l});var i=t(4848),s=t(8453);const r={},o="Domains",d={id:"configuration/domains",title:"Domains",description:"Domains group Agents together. They help isolate groups and allow the creation of rule for incoming and",source:"@site/versioned_docs/version-1.x.x/configuration/domains.md",sourceDirName:"configuration",slug:"/configuration/domains",permalink:"/docs/1.x.x/configuration/domains",draft:!1,unlisted:!1,editUrl:"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-1.x.x/configuration/domains.md",tags:[],version:"1.x.x",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"Agents",permalink:"/docs/1.x.x/configuration/agents"},next:{title:"Gateways",permalink:"/docs/1.x.x/configuration/gateways"}},c={},l=[{value:"Domain Resource",id:"domain-resource",level:2},{value:"Example",id:"example",level:2}];function a(e){const n={blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",li:"li",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.h1,{id:"domains",children:"Domains"}),"\n",(0,i.jsxs)(n.p,{children:["Domains group Agents together. They help isolate groups and allow the creation of rule for incoming and\noutgoing calling. The domains configuration can be provided using the file ",(0,i.jsx)(n.code,{children:"config/domains.yml"})," located at the root of your Routr installation."]}),"\n",(0,i.jsxs)(n.blockquote,{children:["\n",(0,i.jsx)(n.p,{children:"If using Redis this configuration gets stored in the database."}),"\n"]}),"\n",(0,i.jsx)(n.h2,{id:"domain-resource",children:"Domain Resource"}),"\n",(0,i.jsxs)(n.table,{children:[(0,i.jsx)(n.thead,{children:(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.th,{children:"Property"}),(0,i.jsx)(n.th,{children:"Description"}),(0,i.jsx)(n.th,{children:"Required"})]})}),(0,i.jsxs)(n.tbody,{children:[(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{children:"apiVersion"}),(0,i.jsx)(n.td,{children:"Indicates the version of the resource (Not yet implemented)"}),(0,i.jsx)(n.td,{children:"Yes"})]}),(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{children:"kind"}),(0,i.jsx)(n.td,{children:"Defines the type of resource"}),(0,i.jsx)(n.td,{children:"Yes"})]}),(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{children:"metadata.name"}),(0,i.jsx)(n.td,{children:"Friendly name for the SIP domain"}),(0,i.jsx)(n.td,{children:"Yes"})]}),(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{children:"spec.context.domainUri"}),(0,i.jsx)(n.td,{children:"Domain URI. FQDN is recommended"}),(0,i.jsx)(n.td,{children:"Yes"})]}),(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{children:"spec.context.egressPolicy.rule"}),(0,i.jsxs)(n.td,{children:["Regular expression indicating when a call will be routed via ",(0,i.jsx)(n.code,{children:"spec.context.egressPolicy.numberRef"})]}),(0,i.jsx)(n.td,{children:"No"})]}),(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{children:"spec.context.egressPolicy.numberRef"}),(0,i.jsx)(n.td,{children:"Reference to the Number that will route the call"}),(0,i.jsx)(n.td,{children:"No"})]}),(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{children:"spec.context.accessControlList.allow[*]"}),(0,i.jsx)(n.td,{children:"Traffic allow for Network in list"}),(0,i.jsx)(n.td,{children:"No"})]}),(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{children:"spec.context.accessControlList.deny[*]"}),(0,i.jsx)(n.td,{children:"Traffic disabled for Network in list"}),(0,i.jsx)(n.td,{children:"No"})]})]})]}),"\n",(0,i.jsx)(n.p,{children:"ACL Rules may be in CIDR, IP/Mask, or single IP format. Example of rules are:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsx)(n.li,{children:"0.0.0.0/1 # all"}),"\n",(0,i.jsx)(n.li,{children:"192.168.1.0/255.255.255.0"}),"\n",(0,i.jsx)(n.li,{children:"192.168.0.1/31"}),"\n"]}),"\n",(0,i.jsx)(n.h2,{id:"example",children:"Example"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:"language-yaml",children:"- apiVersion: v1beta1\n  kind: Domain\n  metadata:\n    name: Local Server\n  spec:\n    context:\n      domainUri: sip.local\n      egressPolicy:\n        rule: .*\n        numberRef: Number0001\n      accessControlList:\n        deny: [0.0.0.0/1]     # Deny all\n        allow: [192.168.0.1/31]\n"})})]})}function h(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(a,{...e})}):a(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>o,x:()=>d});var i=t(6540);const s={},r=i.createContext(s);function o(e){const n=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function d(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),i.createElement(r.Provider,{value:n},e.children)}}}]);