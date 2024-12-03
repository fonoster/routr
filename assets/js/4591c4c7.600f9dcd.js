"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[5315],{9022:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>a,contentTitle:()=>i,default:()=>d,frontMatter:()=>c,metadata:()=>s,toc:()=>l});const s=JSON.parse('{"id":"connect/quick-start/kubernetes","title":"Installing in Kubernetes","description":"Routr can be installed in Kubernetes using Helm. The following instructions assume that you have a Kubernetes cluster up and running.","source":"@site/versioned_docs/version-2.0.0/connect/quick-start/kubernetes.md","sourceDirName":"connect/quick-start","slug":"/connect/quick-start/kubernetes","permalink":"/docs/2.0.0/connect/quick-start/kubernetes","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-2.0.0/connect/quick-start/kubernetes.md","tags":[],"version":"2.0.0","sidebarPosition":2,"frontMatter":{"sidebar_position":2},"sidebar":"tutorialSidebar","previous":{"title":"Docker installation","permalink":"/docs/2.0.0/connect/quick-start/docker"},"next":{"title":"Overview","permalink":"/docs/2.0.0/connect/command-line/overview"}}');var r=t(4848),o=t(8453);const c={sidebar_position:2},i="Installing in Kubernetes",a={},l=[];function u(e){const n={a:"a",blockquote:"blockquote",code:"code",h1:"h1",header:"header",p:"p",pre:"pre",...(0,o.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.header,{children:(0,r.jsx)(n.h1,{id:"installing-in-kubernetes",children:"Installing in Kubernetes"})}),"\n",(0,r.jsx)(n.p,{children:"Routr can be installed in Kubernetes using Helm. The following instructions assume that you have a Kubernetes cluster up and running."}),"\n",(0,r.jsxs)(n.blockquote,{children:["\n",(0,r.jsx)(n.p,{children:"You can use Minikube or Docker Desktop to create a local Kubernetes cluster."}),"\n"]}),"\n",(0,r.jsx)(n.p,{children:"First, add the Helm repository:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"helm repo add routr https://routr.io/charts\nhelm repo update\n"})}),"\n",(0,r.jsx)(n.p,{children:"Then, create a namespace for Routr:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"kubectl create namespace sipnet\n"})}),"\n",(0,r.jsx)(n.p,{children:"Next, install Routr with the following command:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"helm install sipnet routr/routr-connect --namespace sipnet\n"})}),"\n",(0,r.jsx)(n.p,{children:"Finally, wait a few minutes for the pods to start. You can check the status of the pods with the following command:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"kubectl get pods -n sipnet\n"})}),"\n",(0,r.jsx)(n.p,{children:"You should see a list of pods and their status. If the status is Running, then you are ready to go."}),"\n",(0,r.jsxs)(n.p,{children:["For more details, please refer to the chart's ",(0,r.jsx)(n.a,{href:"https://github.com/fonoster/routr/blob/main/ops/charts/connect/README.md",children:"README"}),"."]}),"\n",(0,r.jsxs)(n.p,{children:["Please see the ",(0,r.jsx)(n.a,{href:"/docs/2.0.0/connect/command-line/overview",children:"Command-Line Tools"})," section for detauls on how to interact with Routr Connect via the CLI."]})]})}function d(e={}){const{wrapper:n}={...(0,o.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(u,{...e})}):u(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>c,x:()=>i});var s=t(6540);const r={},o=s.createContext(r);function c(e){const n=s.useContext(o);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function i(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:c(e.components),s.createElement(o.Provider,{value:n},e.children)}}}]);