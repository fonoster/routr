"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[5365],{4734:(e,t,s)=>{s.r(t),s.d(t,{assets:()=>o,contentTitle:()=>l,default:()=>h,frontMatter:()=>i,metadata:()=>d,toc:()=>c});var n=s(4848),r=s(8453);const i={},l="listPeers",d={id:"api/peers/list",title:"listPeers",description:"This method returns a list of Peer resources.",source:"@site/versioned_docs/version-1.x.x/api/peers/list.md",sourceDirName:"api/peers",slug:"/api/peers/list",permalink:"/docs/1.x.x/api/peers/list",draft:!1,unlisted:!1,editUrl:"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-1.x.x/api/peers/list.md",tags:[],version:"1.x.x",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"getPeer",permalink:"/docs/1.x.x/api/peers/get"},next:{title:"updatePeer",permalink:"/docs/1.x.x/api/peers/update"}},o={},c=[];function a(e){const t={a:"a",code:"code",h1:"h1",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,r.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(t.h1,{id:"listpeers",children:"listPeers"}),"\n",(0,n.jsx)(t.p,{children:"This method returns a list of Peer resources."}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.strong,{children:"URL"})}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.code,{children:"/peers"})}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.strong,{children:"Method"})}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.code,{children:"GET"})}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.strong,{children:"Parameters"})}),"\n",(0,n.jsxs)(t.table,{children:[(0,n.jsx)(t.thead,{children:(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.th,{children:"Parameter Name"}),(0,n.jsx)(t.th,{style:{textAlign:"left"},children:"Type"}),(0,n.jsx)(t.th,{style:{textAlign:"left"},children:"Value"}),(0,n.jsx)(t.th,{style:{textAlign:"left"},children:"Description"})]})}),(0,n.jsxs)(t.tbody,{children:[(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:"filter"}),(0,n.jsx)(t.td,{style:{textAlign:"left"},children:"query"}),(0,n.jsx)(t.td,{style:{textAlign:"left"},children:"string"}),(0,n.jsx)(t.td,{style:{textAlign:"left"},children:"Use filter to narrow the elements shown"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:"page"}),(0,n.jsx)(t.td,{style:{textAlign:"left"},children:"query"}),(0,n.jsx)(t.td,{style:{textAlign:"left"},children:"number"}),(0,n.jsx)(t.td,{style:{textAlign:"left"},children:"Pagination index"})]}),(0,n.jsxs)(t.tr,{children:[(0,n.jsx)(t.td,{children:"itemsPerPage"}),(0,n.jsx)(t.td,{style:{textAlign:"left"},children:"query"}),(0,n.jsx)(t.td,{style:{textAlign:"left"},children:"number"}),(0,n.jsx)(t.td,{style:{textAlign:"left"},children:"Number of elements per request"})]})]})]}),"\n",(0,n.jsxs)(t.p,{children:["Note: The filter parameter uses ",(0,n.jsx)(t.a,{href:"https://github.com/json-path/JsonPath",children:"JsonPath"})," format"]}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.strong,{children:"Request body"})}),"\n",(0,n.jsx)(t.p,{children:"Do not supply a request body with this method."}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.strong,{children:"Response"})}),"\n",(0,n.jsx)(t.p,{children:"If successful this method returns a list of Peer resources."}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.strong,{children:"Sample Call"})}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-json",children:'GET /api/{apiversion}/peers\n{\n\n}\n\nHTTP/1.1 200 OK\n{\n  "status": "200",\n  "message": "Successful request",\n  "meta": {\n    "currentPage": 1,\n    "totalPages": 1,\n    "itemsPerPage": 30,\n    "totalItems": 1\n  },  \n  "data" : [{\n  \t"apiVersion": "v1beta1",\n  \t"kind": "Peer",\n  \t"metadata": {\n  \t\t"name": "Asterisk PBX",\n      "ref": "pr2c77f4"\n  \t},\n  \t"spec": {\n  \t\t"credentials": {\n  \t\t\t"username": "ast",\n  \t\t\t"secret": "1234"\n  \t\t}\n  \t}\n  }]\n}\n'})})]})}function h(e={}){const{wrapper:t}={...(0,r.R)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(a,{...e})}):a(e)}},8453:(e,t,s)=>{s.d(t,{R:()=>l,x:()=>d});var n=s(6540);const r={},i=n.createContext(r);function l(e){const t=n.useContext(i);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function d(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),n.createElement(i.Provider,{value:t},e.children)}}}]);