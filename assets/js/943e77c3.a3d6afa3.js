"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[1224],{4705:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>i,contentTitle:()=>c,default:()=>p,frontMatter:()=>o,metadata:()=>r,toc:()=>d});const r=JSON.parse('{"id":"api/gateways/create","title":"createGateway","description":"Creates a new Gateway resource.","source":"@site/versioned_docs/version-1.x.x/api/gateways/create.md","sourceDirName":"api/gateways","slug":"/api/gateways/create","permalink":"/docs/1.x.x/api/gateways/create","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-1.x.x/api/gateways/create.md","tags":[],"version":"1.x.x","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"updateDomain","permalink":"/docs/1.x.x/api/domains/update"},"next":{"title":"deleteGateway","permalink":"/docs/1.x.x/api/gateways/delete"}}');var s=n(4848),a=n(8453);const o={},c="createGateway",i={},d=[];function l(e){const t={a:"a",code:"code",h1:"h1",header:"header",p:"p",pre:"pre",strong:"strong",...(0,a.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(t.header,{children:(0,s.jsx)(t.h1,{id:"creategateway",children:"createGateway"})}),"\n",(0,s.jsx)(t.p,{children:"Creates a new Gateway resource."}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.strong,{children:"URL"})}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.code,{children:"/gateways"})}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.strong,{children:"Method"})}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.code,{children:"POST"})}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.strong,{children:"Parameters"})}),"\n",(0,s.jsx)(t.p,{children:"This method does not receive any parameters."}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.strong,{children:"Request body"})}),"\n",(0,s.jsxs)(t.p,{children:["A file containing a ",(0,s.jsx)(t.a,{href:"/docs/1.x.x/configuration/gateways",children:"Gateway"})," resource in ",(0,s.jsx)(t.code,{children:"json"})," format."]}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.strong,{children:"Response"})}),"\n",(0,s.jsx)(t.p,{children:"If successful this method creates a Gateway resource."}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.strong,{children:"Sample Call"})}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-json",children:'POST /api/{apiversion}/gateways\n{\n\t"apiVersion": "v1beta1",\n\t"kind": "Gateway",\n\t"metadata": {\n\t\t"name": "Provider Inc."\n\t},\n\t"spec": {\n\t\t"host": "sip.provider.net",\n\t\t"credentials": {\n\t\t\t"username": "youruser",\n\t\t\t"secret": "yoursecret"\n\t\t},\n\t\t"transport": "udp"\n\t}\n}\n\n\nHTTP/1.1 201 Created\n{\n\t"status": "201",\n\t"message": "Created",\n\t"data": "gw5c77t2"\n}\n'})})]})}function p(e={}){const{wrapper:t}={...(0,a.R)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(l,{...e})}):l(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>o,x:()=>c});var r=n(6540);const s={},a=r.createContext(s);function o(e){const t=r.useContext(a);return r.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function c(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),r.createElement(a.Provider,{value:t},e.children)}}}]);