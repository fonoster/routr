"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[9042],{9889:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>a,contentTitle:()=>d,default:()=>x,frontMatter:()=>l,metadata:()=>s,toc:()=>o});const s=JSON.parse('{"id":"api/registry","title":"registry","description":"This method gets a list of available(online) gateways.","source":"@site/versioned_docs/version-1.x.x/api/registry.md","sourceDirName":"api","slug":"/api/registry","permalink":"/docs/1.x.x/api/registry","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-1.x.x/api/registry.md","tags":[],"version":"1.x.x","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"updatePeer","permalink":"/docs/1.x.x/api/peers/update"},"next":{"title":"checkSystemStatus","permalink":"/docs/1.x.x/api/status/get"}}');var r=n(4848),i=n(8453);const l={},d=void 0,a={},o=[];function c(e){const t={code:"code",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,i.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(t.p,{children:"This method gets a list of available(online) gateways."}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"URL"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.code,{children:"/registry"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Method"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.code,{children:"GET"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Parameters"})}),"\n",(0,r.jsxs)(t.table,{children:[(0,r.jsx)(t.thead,{children:(0,r.jsxs)(t.tr,{children:[(0,r.jsx)(t.th,{children:"Parameter Name"}),(0,r.jsx)(t.th,{style:{textAlign:"left"},children:"Type"}),(0,r.jsx)(t.th,{style:{textAlign:"left"},children:"Value"}),(0,r.jsx)(t.th,{style:{textAlign:"left"},children:"Description"})]})}),(0,r.jsxs)(t.tbody,{children:[(0,r.jsxs)(t.tr,{children:[(0,r.jsx)(t.td,{children:"page"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"query"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"number"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"Pagination index"})]}),(0,r.jsxs)(t.tr,{children:[(0,r.jsx)(t.td,{children:"itemsPerPage"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"query"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"number"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"Number of elements per request"})]})]})]}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Request body"})}),"\n",(0,r.jsx)(t.p,{children:"Do not supply a request body with this method."}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Response"})}),"\n",(0,r.jsx)(t.p,{children:"This method returns a list with registered devices."}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Sample Call"})}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-json",children:'GET /api/{apiversion}/registry\n{\n\n}\n\nHTTP/1.1 200 OK\n{\n   "status": 200,\n   "message": "Successful request",\n   "meta": {\n      "currentPage": 1,\n      "totalPages": 1,\n      "itemsPerPage": 30,\n      "totalItems": 1\n   },\n   "data": [\n      {\n         "username": "215706",\n         "host": "atlanta2.voip.ms",\n         "ip":"209.217.224.50",\n         "expires": 600,\n         "registeredOn": 1588525156280,\n         "gwRef": "gw50a1a4ca",\n         "gwURI": "sip:215706@atlanta2.voip.ms:5060",\n         "regOnFormatted": "a few seconds ago"\n      }\n   ]\n}\n'})})]})}function x(e={}){const{wrapper:t}={...(0,i.R)(),...e.components};return t?(0,r.jsx)(t,{...e,children:(0,r.jsx)(c,{...e})}):c(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>l,x:()=>d});var s=n(6540);const r={},i=s.createContext(r);function l(e){const t=s.useContext(i);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function d(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),s.createElement(i.Provider,{value:t},e.children)}}}]);