"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[6792],{9397:(e,n,r)=>{r.r(n),r.d(n,{assets:()=>c,contentTitle:()=>i,default:()=>l,frontMatter:()=>u,metadata:()=>t,toc:()=>d});const t=JSON.parse('{"id":"guides/running-on-kubernetes","title":"Running on Kubernetes","description":"This document is a short guide about running the dockerized version of Routr Server on Kubernetes.","source":"@site/versioned_docs/version-1.x.x/guides/running-on-kubernetes.md","sourceDirName":"guides","slug":"/guides/running-on-kubernetes","permalink":"/docs/1.x.x/guides/running-on-kubernetes","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr/edit/main/docs/docs/versioned_docs/version-1.x.x/guides/running-on-kubernetes.md","tags":[],"version":"1.x.x","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Routr as Asterisk frontend","permalink":"/docs/1.x.x/guides/routr-as-asterisk-frontend"},"next":{"title":"Running with Docker","permalink":"/docs/1.x.x/guides/running-with-docker-or-compose"}}');var s=r(4848),o=r(8453);const u={},i="Running on Kubernetes",c={},d=[{value:"Run in Kubernetes",id:"run-in-kubernetes",level:2}];function a(e){const n={blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",header:"header",p:"p",pre:"pre",...(0,o.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.header,{children:(0,s.jsx)(n.h1,{id:"running-on-kubernetes",children:"Running on Kubernetes"})}),"\n",(0,s.jsx)(n.p,{children:"This document is a short guide about running the dockerized version of Routr Server on Kubernetes."}),"\n",(0,s.jsx)(n.h2,{id:"run-in-kubernetes",children:"Run in Kubernetes"}),"\n",(0,s.jsxs)(n.p,{children:["To run Routr in Kubernetes, you must set your EXTERN_ADDR in ",(0,s.jsx)(n.code,{children:".k8s/routr.yml"}),"."]}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsx)(n.p,{children:"This variable must be set to the public address(if running Routr locally, use your host address)"}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:"Additionally, you must create the following Kubernetes resources:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-bash",children:"kubectl create -f k8s/configmaps.yml\nkubectl create -f k8s/redis.yml\nkubectl create -f k8s/routr.yml\n"})})]})}function l(e={}){const{wrapper:n}={...(0,o.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(a,{...e})}):a(e)}},8453:(e,n,r)=>{r.d(n,{R:()=>u,x:()=>i});var t=r(6540);const s={},o=t.createContext(s);function u(e){const n=t.useContext(o);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function i(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:u(e.components),t.createElement(o.Provider,{value:n},e.children)}}}]);