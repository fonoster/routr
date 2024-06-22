"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[1071],{4615:(e,o,t)=>{t.r(o),t.d(o,{assets:()=>c,contentTitle:()=>s,default:()=>p,frontMatter:()=>r,metadata:()=>a,toc:()=>d});var n=t(4848),i=t(8453);const r={},s="Development with Gitpod",a={id:"development/development-mode-with-gitpod",title:"Development with Gitpod",description:"Development mode with Gitpod is a great way to get familiar with Routr. Gitpod is a cloud-based IDE that allows you to develop and test your code in a browser. Gitpod is free for open-source projects and offers a free trial for private repositories.",source:"@site/versioned_docs/version-2.0.0/development/development-mode-with-gitpod.md",sourceDirName:"development",slug:"/development/development-mode-with-gitpod",permalink:"/docs/2.0.0/development/development-mode-with-gitpod",draft:!1,unlisted:!1,editUrl:"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-2.0.0/development/development-mode-with-gitpod.md",tags:[],version:"2.0.0",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"Quick Start",permalink:"/docs/2.0.0/development/quick-start"},next:{title:"Overview",permalink:"/docs/2.0.0/development/components/overview"}},c={},d=[];function l(e){const o={a:"a",blockquote:"blockquote",code:"code",h1:"h1",img:"img",p:"p",pre:"pre",...(0,i.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(o.h1,{id:"development-with-gitpod",children:"Development with Gitpod"}),"\n",(0,n.jsx)(o.p,{children:"Development mode with Gitpod is a great way to get familiar with Routr. Gitpod is a cloud-based IDE that allows you to develop and test your code in a browser. Gitpod is free for open-source projects and offers a free trial for private repositories."}),"\n",(0,n.jsx)(o.p,{children:"To launch a Gitpod workspace, click the button below:"}),"\n",(0,n.jsx)(o.p,{children:(0,n.jsx)(o.a,{href:"https://gitpod.io/#https://github.com/fonoster/routr",children:(0,n.jsx)(o.img,{src:"https://gitpod.io/button/open-in-gitpod.svg",alt:"Open in Gitpod"})})}),"\n",(0,n.jsx)(o.p,{children:"This link will open a new tab on your browser and start a new workspace, which may take a few minutes. The starting process might take a few minutes. Once the workspace is ready, you will see a terminal and a file explorer similar to VSCode."}),"\n",(0,n.jsx)(o.p,{children:"While the workspace starts, let's review the steps required to forward SIP signaling traffic from your local computer to Gitpod."}),"\n",(0,n.jsx)(o.p,{children:"First, add your public SSH keys to your Gitpod account by going to the Gitpod account keys and adding your public key. You can do this using the link below:"}),"\n",(0,n.jsx)(o.p,{children:(0,n.jsx)(o.a,{href:"https://gitpod.io/user/keys",children:"https://gitpod.io/user/keys"})}),"\n",(0,n.jsx)(o.p,{children:(0,n.jsx)(o.img,{alt:"Gitpod account keys",src:t(6803).A+"",width:"1358",height:"527"})}),"\n",(0,n.jsx)(o.p,{children:"On Linux or macOS, you can find your public key by running the following command in your terminal:"}),"\n",(0,n.jsx)(o.pre,{children:(0,n.jsx)(o.code,{className:"language-bash",children:"cat ~/.ssh/id_rsa.pub\n"})}),"\n",(0,n.jsx)(o.p,{children:"Or, if you are using Windows, you can find your public key using this command in your terminal:"}),"\n",(0,n.jsx)(o.pre,{children:(0,n.jsx)(o.code,{className:"language-bash",children:"cat %USERPROFILE%\\.ssh\\id_rsa.pub\n"})}),"\n",(0,n.jsx)(o.p,{children:"If you don't have a public key, you can generate one by running the following command in your terminal:"}),"\n",(0,n.jsx)(o.pre,{children:(0,n.jsx)(o.code,{className:"language-bash",children:'ssh-keygen -t rsa -b 4096 -C "your_email@example.com"\n'})}),"\n",(0,n.jsx)(o.p,{children:'Once you add your key, find your Gitpod workspace and click the "More" button. Then, select "Connect via SSH."'}),"\n",(0,n.jsx)(o.p,{children:(0,n.jsx)(o.a,{href:"https://gitpod.io/workspaces",children:"https://gitpod.io/workspaces"})}),"\n",(0,n.jsx)(o.p,{children:(0,n.jsx)(o.img,{alt:"Gitpod workspace",src:t(5430).A+"",width:"1360",height:"588"})}),"\n",(0,n.jsxs)(o.p,{children:["You want to be able to access port ",(0,n.jsx)(o.code,{children:"5060"})," from your local computer to connect to Routr using a SIPUA. We must create a port-forward from our local machine to the Gitpod workspace to do that."]}),"\n",(0,n.jsxs)(o.p,{children:["To create the port forward, take the SSH connection string and add ",(0,n.jsx)(o.code,{children:"-L 5060:localhost:5060"})," to the end of the line. For example, your command might look like this:"]}),"\n",(0,n.jsx)(o.pre,{children:(0,n.jsx)(o.code,{className:"language-bash",children:"ssh <workspace-ssh-connection> -L 5060:localhost:5060\n"})}),"\n",(0,n.jsx)(o.p,{children:'Be sure to replace "workspace SSH connection" with your local connection.'}),"\n",(0,n.jsx)(o.p,{children:"Here is an example of what the command might look like:"}),"\n",(0,n.jsx)(o.pre,{children:(0,n.jsx)(o.code,{className:"language-bash",children:"ssh fonoster-routr-mn8nsx0d9px@fonoster-routr-mn8nsx0d9px.ssh.ws-us90.gitpod.io -L 5060:localhost:5060 \n"})}),"\n",(0,n.jsxs)(o.p,{children:["This command forwards traffic from your local port ",(0,n.jsx)(o.code,{children:"5060"})," to your Gitpod workspace's port ",(0,n.jsx)(o.code,{children:"5060"}),", allowing you to connect via SIP."]}),"\n",(0,n.jsxs)(o.blockquote,{children:["\n",(0,n.jsx)(o.p,{children:"Unfortunately, SSH does not natively support forwarding UDP traffic. It only provides port forwarding functionality for TCP connections. Therefore, you cannot enable UDP delivering directly with the previous SSH Command."}),"\n"]}),"\n",(0,n.jsx)(o.p,{children:'This setup uses the "simpledata" implementation of the APIServer, which uses YAML files as the data source. Here is a list of the YAML files that make up the configuration:'}),"\n",(0,n.jsx)(o.p,{children:(0,n.jsx)(o.a,{href:"https://github.com/fonoster/routr/blob/main/config/resources",children:"https://github.com/fonoster/routr/blob/main/config/resources"})}),"\n",(0,n.jsx)(o.p,{children:"Feel free to explore these files and make changes as needed."})]})}function p(e={}){const{wrapper:o}={...(0,i.R)(),...e.components};return o?(0,n.jsx)(o,{...e,children:(0,n.jsx)(l,{...e})}):l(e)}},6803:(e,o,t)=>{t.d(o,{A:()=>n});const n=t.p+"assets/images/gitpod-account-keys-0833e0da64fdd0fa6867611cb583a0fc.png"},5430:(e,o,t)=>{t.d(o,{A:()=>n});const n=t.p+"assets/images/gitpod-workspace-9a23cadbc9b3dfdfa8eda64fe4da4475.png"},8453:(e,o,t)=>{t.d(o,{R:()=>s,x:()=>a});var n=t(6540);const i={},r=n.createContext(i);function s(e){const o=n.useContext(r);return n.useMemo((function(){return"function"==typeof e?e(o):{...o,...e}}),[o,e])}function a(e){let o;return o=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:s(e.components),n.createElement(r.Provider,{value:o},e.children)}}}]);