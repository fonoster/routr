"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[6944],{6835:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>a,contentTitle:()=>l,default:()=>h,frontMatter:()=>i,metadata:()=>r,toc:()=>d});const r=JSON.parse('{"id":"introduction/installation","title":"Installation","description":"Instant Server Installation with Snaps","source":"@site/versioned_docs/version-1.x.x/introduction/installation.md","sourceDirName":"introduction","slug":"/introduction/installation","permalink":"/docs/1.x.x/introduction/installation","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-1.x.x/introduction/installation.md","tags":[],"version":"1.x.x","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Overview","permalink":"/docs/1.x.x/introduction/overview"},"next":{"title":"Comparison","permalink":"/docs/1.x.x/introduction/comparison"}}');var s=n(4848),o=n(8453);const i={},l="Installation",a={},d=[{value:"Instant Server Installation with Snaps",id:"instant-server-installation-with-snaps",level:2},{value:"DigitalOcean droplet",id:"digitalocean-droplet",level:2},{value:"Docker",id:"docker",level:2},{value:"Kubernetes",id:"kubernetes",level:2},{value:"Google Cloud Shell",id:"google-cloud-shell",level:2},{value:"Custom",id:"custom",level:2}];function c(e){const t={a:"a",code:"code",h1:"h1",h2:"h2",header:"header",img:"img",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,o.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(t.header,{children:(0,s.jsx)(t.h1,{id:"installation",children:"Installation"})}),"\n",(0,s.jsx)(t.h2,{id:"instant-server-installation-with-snaps",children:"Instant Server Installation with Snaps"}),"\n",(0,s.jsx)(t.p,{children:"Install Routr in seconds on Linux (Ubuntu and others) with:"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-bash",children:"sudo snap install routr-server\n"})}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.a,{href:"https://snapcraft.io/routr-server",children:(0,s.jsx)(t.img,{src:"https://snapcraft.io/static/images/badges/en/snap-store-black.svg",alt:"Get it from the Snap Store"})})}),"\n",(0,s.jsx)(t.p,{children:"Routr Snap is recommended for Linux deployments"}),"\n",(0,s.jsx)(t.p,{children:"Installing snaps is very quick. By running that command you have your full Routr server up and running. Snaps are secure. They are isolated with all of their dependencies. Snaps also auto-update when we release new versions."}),"\n",(0,s.jsx)(t.h2,{id:"digitalocean-droplet",children:"DigitalOcean droplet"}),"\n",(0,s.jsx)(t.p,{children:"Build and Deploy to a DigitalOcean droplet"}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.a,{href:"https://github.com/fonoster/routr/tree/master/.digitalocean/README.md",children:(0,s.jsx)(t.img,{src:"https://user-images.githubusercontent.com/51996/58146107-50512580-7c1a-11e9-8ec9-e032ba387c2a.png",alt:"do-btn-blue"})})}),"\n",(0,s.jsx)(t.h2,{id:"docker",children:"Docker"}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.a,{href:"/docs/1.x.x/guides/running-with-docker-or-compose",children:"Deploy with docker compose"})}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.a,{href:"https://hub.docker.com/r/fonoster/routr/",children:(0,s.jsx)(t.img,{src:"https://d207aa93qlcgug.cloudfront.net/1.95.5.qa/img/nav/docker-logo-loggedout.png",alt:"Docker logo"})})}),"\n",(0,s.jsxs)(t.p,{children:["OR Use the automated build image of our ",(0,s.jsx)(t.a,{href:"https://hub.docker.com/r/fonoster/routr/",children:"most recent release"})]}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{children:"docker pull fonoster/routr:latest\n"})}),"\n",(0,s.jsxs)(t.p,{children:["OR select a specific release (",(0,s.jsx)(t.a,{href:"https://github.com/fonoster/routr/releases",children:"details of releases available"}),"):"]}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{children:"docker pull fonoster/routr:vX.X.X\n"})}),"\n",(0,s.jsx)(t.h2,{id:"kubernetes",children:"Kubernetes"}),"\n",(0,s.jsxs)(t.p,{children:["Deploy to Kubernetes in ",(0,s.jsx)(t.a,{href:"https://github.com/fonoster/routr/tree/master/.k8s/README.md",children:"few easy steps"})]}),"\n",(0,s.jsx)(t.h2,{id:"google-cloud-shell",children:"Google Cloud Shell"}),"\n",(0,s.jsx)(t.p,{children:"Routr one-click interactive tutorial will get you familiar with Routr server and the command-line interface."}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.a,{href:"https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/fonoster/routr-walkthrough-tutorial&tutorial=tutorial.md",children:(0,s.jsx)(t.img,{src:"https://gstatic.com/cloudssh/images/open-btn.svg",alt:"Open in Cloud Shell"})})}),"\n",(0,s.jsx)(t.h2,{id:"custom",children:"Custom"}),"\n",(0,s.jsx)(t.p,{children:"There are no special requirements to install and run the server. Just follow this easy steps:"}),"\n",(0,s.jsx)(t.p,{children:"\u278a Download the server for your platform"}),"\n",(0,s.jsxs)(t.table,{children:[(0,s.jsx)(t.thead,{children:(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.th,{children:"Platform"}),(0,s.jsx)(t.th,{children:"Download"})]})}),(0,s.jsxs)(t.tbody,{children:[(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"Linux"}),(0,s.jsx)(t.td,{children:(0,s.jsx)(t.a,{href:"https://github.com/fonoster/routr/releases/download/1.2.7/routr-1.2.7_linux-x64_bin.tar.gz",children:"tar.gz"})})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"macOS"}),(0,s.jsx)(t.td,{children:(0,s.jsx)(t.a,{href:"https://github.com/fonoster/routr/releases/download/1.2.7/routr-1.2.7_osx-x64_bin.tar.gz",children:"tar.gz"})})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"Windows"}),(0,s.jsxs)(t.td,{children:[(0,s.jsx)(t.a,{href:"https://github.com/fonoster/routr/releases/download/1.2.7/routr-1.2.7_windows-x64_bin.tar.gz",children:"tar.gz"}),", ",(0,s.jsx)(t.a,{href:"https://github.com/fonoster/routr/releases/download/1.2.7/routr-1.2.7_windows-x64_bin.zip",children:"zip"})]})]})]})]}),"\n",(0,s.jsx)(t.p,{children:"\u278b Then extract it:"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-bash",children:"tar xvfz routr-*.tar.gz\ncd routr-*\n"})}),"\n",(0,s.jsxs)(t.p,{children:["\u278c Run the server using the ",(0,s.jsx)(t.code,{children:"routr"})," command"]}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-bash",children:"./routr\n"})})]})}function h(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(c,{...e})}):c(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>i,x:()=>l});var r=n(6540);const s={},o=r.createContext(s);function i(e){const t=r.useContext(o);return r.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function l(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:i(e.components),r.createElement(o.Provider,{value:t},e.children)}}}]);