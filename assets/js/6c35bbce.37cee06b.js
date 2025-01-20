"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[4862],{3884:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>a,contentTitle:()=>d,default:()=>h,frontMatter:()=>l,metadata:()=>s,toc:()=>o});const s=JSON.parse('{"id":"api/agents/list","title":"listAgents","description":"This method returns a list of Agent resources.","source":"@site/versioned_docs/version-1.x.x/api/agents/list.md","sourceDirName":"api/agents","slug":"/api/agents/list","permalink":"/docs/1.x.x/api/agents/list","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr/edit/main/docs/docs/versioned_docs/version-1.x.x/api/agents/list.md","tags":[],"version":"1.x.x","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"getAgent","permalink":"/docs/1.x.x/api/agents/get"},"next":{"title":"updateAgent","permalink":"/docs/1.x.x/api/agents/update"}}');var r=n(4848),i=n(8453);const l={},d="listAgents",a={},o=[];function c(e){const t={a:"a",code:"code",h1:"h1",header:"header",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,i.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(t.header,{children:(0,r.jsx)(t.h1,{id:"listagents",children:"listAgents"})}),"\n",(0,r.jsx)(t.p,{children:"This method returns a list of Agent resources."}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"URL"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.code,{children:"/agents"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Method"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.code,{children:"GET"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Parameters"})}),"\n",(0,r.jsxs)(t.table,{children:[(0,r.jsx)(t.thead,{children:(0,r.jsxs)(t.tr,{children:[(0,r.jsx)(t.th,{children:"Parameter Name"}),(0,r.jsx)(t.th,{style:{textAlign:"left"},children:"Type"}),(0,r.jsx)(t.th,{style:{textAlign:"left"},children:"Value"}),(0,r.jsx)(t.th,{style:{textAlign:"left"},children:"Description"})]})}),(0,r.jsxs)(t.tbody,{children:[(0,r.jsxs)(t.tr,{children:[(0,r.jsx)(t.td,{children:"filter"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"query"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"string"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"Use filter to narrow the elements shown"})]}),(0,r.jsxs)(t.tr,{children:[(0,r.jsx)(t.td,{children:"page"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"query"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"number"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"Pagination index"})]}),(0,r.jsxs)(t.tr,{children:[(0,r.jsx)(t.td,{children:"itemsPerPage"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"query"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"number"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"Number of elements per request"})]})]})]}),"\n",(0,r.jsxs)(t.p,{children:["Note: The filter parameter uses ",(0,r.jsx)(t.a,{href:"https://github.com/json-path/JsonPath",children:"JsonPath"})," format"]}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Request body"})}),"\n",(0,r.jsx)(t.p,{children:"Do not supply a request body with this method."}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Response"})}),"\n",(0,r.jsx)(t.p,{children:"If successful this method returns a list of Agent resources."}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Sample Call"})}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-json",children:'GET /api/{apiversion}/agents\n{\n\n}\n\nHTTP/1.1 200 OK\n{\n  "status": "200",\n  "message": "Successful request",\n  "meta": {\n    "currentPage": 1,\n    "totalPages": 1,\n    "itemsPerPage": 30,\n    "totalItems": 1\n  },\n  "data": [{\n    "apiVersion": "v1beta1",\n    "kind": "Agent",\n    "metadata": {\n    \t"name": "John Doe",\n      "ref": "ag3f77f6"\n    },\n    "spec": {\n    \t"credentials": {\n    \t\t"username": "1001",\n    \t\t"secret": "1234"\n    \t},\n    \t"domains": [\n    \t\t"sip.local"\n    \t]\n    }\n  }]\n}\n'})})]})}function h(e={}){const{wrapper:t}={...(0,i.R)(),...e.components};return t?(0,r.jsx)(t,{...e,children:(0,r.jsx)(c,{...e})}):c(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>l,x:()=>d});var s=n(6540);const r={},i=s.createContext(r);function l(e){const t=s.useContext(i);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function d(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),s.createElement(i.Provider,{value:t},e.children)}}}]);