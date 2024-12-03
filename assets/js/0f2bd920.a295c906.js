"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[2506],{2894:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>o,default:()=>h,frontMatter:()=>l,metadata:()=>s,toc:()=>c});const s=JSON.parse('{"id":"api/location/list","title":"listEndpoints","description":"Gets a list of registered devices.","source":"@site/versioned_docs/version-1.x.x/api/location/list.md","sourceDirName":"api/location","slug":"/api/location/list","permalink":"/docs/1.x.x/api/location/list","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-1.x.x/api/location/list.md","tags":[],"version":"1.x.x","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"evictEndpoint","permalink":"/docs/1.x.x/api/location/delete"},"next":{"title":"createNumber","permalink":"/docs/1.x.x/api/numbers/create"}}');var r=n(4848),i=n(8453);const l={},o="listEndpoints",d={},c=[];function a(e){const t={code:"code",h1:"h1",header:"header",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,i.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(t.header,{children:(0,r.jsx)(t.h1,{id:"listendpoints",children:"listEndpoints"})}),"\n",(0,r.jsx)(t.p,{children:"Gets a list of registered devices."}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"URL"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.code,{children:"/location"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Method"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.code,{children:"GET"})}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Parameters"})}),"\n",(0,r.jsxs)(t.table,{children:[(0,r.jsx)(t.thead,{children:(0,r.jsxs)(t.tr,{children:[(0,r.jsx)(t.th,{children:"Parameter Name"}),(0,r.jsx)(t.th,{style:{textAlign:"left"},children:"Type"}),(0,r.jsx)(t.th,{style:{textAlign:"left"},children:"Value"}),(0,r.jsx)(t.th,{style:{textAlign:"left"},children:"Description"})]})}),(0,r.jsxs)(t.tbody,{children:[(0,r.jsxs)(t.tr,{children:[(0,r.jsx)(t.td,{children:"page"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"query"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"number"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"Pagination index"})]}),(0,r.jsxs)(t.tr,{children:[(0,r.jsx)(t.td,{children:"itemsPerPage"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"query"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"number"}),(0,r.jsx)(t.td,{style:{textAlign:"left"},children:"Number of elements per request"})]})]})]}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Request body"})}),"\n",(0,r.jsx)(t.p,{children:"Do not supply a request body with this method."}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Response"})}),"\n",(0,r.jsx)(t.p,{children:"This method returns a list with registered devices in\nthe response body."}),"\n",(0,r.jsx)(t.p,{children:(0,r.jsx)(t.strong,{children:"Sample Call"})}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-json",children:'GET /api/{apiversion}/location\n{\n\n}\n\nHTTP/1.1 200 OK\n{  \n  "status": 200,\n  "message": "Successful request",\n  "meta": {\n    "currentPage": 1,\n    "totalPages": 1,\n    "itemsPerPage": 30,\n    "totalItems": 1\n  },   \n  "data":[{  \n    "addressOfRecord": "sip:1001@sip.local",\n    "contactInfo": "sip:45962087@192.168.1.127:59985;transport=tcp;nat=false;expires=600"\n  }]\n}\n'})})]})}function h(e={}){const{wrapper:t}={...(0,i.R)(),...e.components};return t?(0,r.jsx)(t,{...e,children:(0,r.jsx)(a,{...e})}):a(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>l,x:()=>o});var s=n(6540);const r={},i=s.createContext(r);function l(e){const t=s.useContext(i);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function o(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),s.createElement(i.Provider,{value:t},e.children)}}}]);