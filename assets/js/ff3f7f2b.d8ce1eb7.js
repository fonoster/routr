"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[6349],{3905:(e,t,o)=>{o.d(t,{Zo:()=>c,kt:()=>f});var n=o(7294);function r(e,t,o){return t in e?Object.defineProperty(e,t,{value:o,enumerable:!0,configurable:!0,writable:!0}):e[t]=o,e}function a(e,t){var o=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),o.push.apply(o,n)}return o}function i(e){for(var t=1;t<arguments.length;t++){var o=null!=arguments[t]?arguments[t]:{};t%2?a(Object(o),!0).forEach((function(t){r(e,t,o[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(o)):a(Object(o)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(o,t))}))}return e}function l(e,t){if(null==e)return{};var o,n,r=function(e,t){if(null==e)return{};var o,n,r={},a=Object.keys(e);for(n=0;n<a.length;n++)o=a[n],t.indexOf(o)>=0||(r[o]=e[o]);return r}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(n=0;n<a.length;n++)o=a[n],t.indexOf(o)>=0||Object.prototype.propertyIsEnumerable.call(e,o)&&(r[o]=e[o])}return r}var p=n.createContext({}),s=function(e){var t=n.useContext(p),o=t;return e&&(o="function"==typeof e?e(t):i(i({},t),e)),o},c=function(e){var t=s(e.components);return n.createElement(p.Provider,{value:t},e.children)},u="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},m=n.forwardRef((function(e,t){var o=e.components,r=e.mdxType,a=e.originalType,p=e.parentName,c=l(e,["components","mdxType","originalType","parentName"]),u=s(o),m=r,f=u["".concat(p,".").concat(m)]||u[m]||d[m]||a;return o?n.createElement(f,i(i({ref:t},c),{},{components:o})):n.createElement(f,i({ref:t},c))}));function f(e,t){var o=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var a=o.length,i=new Array(a);i[0]=m;var l={};for(var p in t)hasOwnProperty.call(t,p)&&(l[p]=t[p]);l.originalType=e,l[u]="string"==typeof e?e:r,i[1]=l;for(var s=2;s<a;s++)i[s]=o[s];return n.createElement.apply(null,i)}return n.createElement.apply(null,o)}m.displayName="MDXCreateElement"},9299:(e,t,o)=>{o.r(t),o.d(t,{assets:()=>p,contentTitle:()=>i,default:()=>d,frontMatter:()=>a,metadata:()=>l,toc:()=>s});var n=o(7462),r=(o(7294),o(3905));const a={},i="Development with Gitpod",l={unversionedId:"development/development-mode-with-gitpod",id:"development/development-mode-with-gitpod",title:"Development with Gitpod",description:"Development mode with Gitpod is a great way to get familiar with Routr. Gitpod is a cloud-based IDE that allows you to develop and test your code in a browser. Gitpod is free for open-source projects and offers a free trial for private repositories.",source:"@site/docs/development/development-mode-with-gitpod.md",sourceDirName:"development",slug:"/development/development-mode-with-gitpod",permalink:"/docs/2.0.0/development/development-mode-with-gitpod",draft:!1,editUrl:"https://github.com/fonoster/routr-website/edit/main/docs/development/development-mode-with-gitpod.md",tags:[],version:"current",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"Quick Start",permalink:"/docs/2.0.0/development/quick-start"},next:{title:"Introduction",permalink:"/docs/2.0.0/connect/introduction"}},p={},s=[],c={toc:s},u="wrapper";function d(e){let{components:t,...a}=e;return(0,r.kt)(u,(0,n.Z)({},c,a,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"development-with-gitpod"},"Development with Gitpod"),(0,r.kt)("p",null,"Development mode with Gitpod is a great way to get familiar with Routr. Gitpod is a cloud-based IDE that allows you to develop and test your code in a browser. Gitpod is free for open-source projects and offers a free trial for private repositories."),(0,r.kt)("p",null,"To launch a Gitpod workspace, click the button below:"),(0,r.kt)("p",null,(0,r.kt)("a",{parentName:"p",href:"https://gitpod.io/#https://github.com/fonoster/routr"},(0,r.kt)("img",{parentName:"a",src:"https://gitpod.io/button/open-in-gitpod.svg",alt:"Open in Gitpod"}))),(0,r.kt)("p",null,"This link will open a new tab on your browser and start a new workspace, which may take a few minutes. The starting process might take a few minutes. Once the workspace is ready, you will see a terminal and a file explorer similar to VSCode."),(0,r.kt)("p",null,"While the workspace starts, let's review the steps required to forward SIP signaling traffic from your local computer to Gitpod."),(0,r.kt)("p",null,"First, add your public SSH keys to your Gitpod account by going to the Gitpod account keys and adding your public key. You can do this using the link below:"),(0,r.kt)("p",null,(0,r.kt)("a",{parentName:"p",href:"https://gitpod.io/user/keys"},"https://gitpod.io/user/keys")),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"Gitpod account keys",src:o(639).Z,width:"1358",height:"527"})),(0,r.kt)("p",null,"On Linux or macOS, you can find your public key by running the following command in your terminal:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"cat ~/.ssh/id_rsa.pub\n")),(0,r.kt)("p",null,"Or, if you are using Windows, you can find your public key using this command in your terminal:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"cat %USERPROFILE%\\.ssh\\id_rsa.pub\n")),(0,r.kt)("p",null,"If you don't have a public key, you can generate one by running the following command in your terminal:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},'ssh-keygen -t rsa -b 4096 -C "your_email@example.com"\n')),(0,r.kt)("p",null,'Once you add your key, find your Gitpod workspace and click the "More" button. Then, select "Connect via SSH."'),(0,r.kt)("p",null,(0,r.kt)("a",{parentName:"p",href:"https://gitpod.io/workspaces"},"https://gitpod.io/workspaces")),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"Gitpod workspace",src:o(4635).Z,width:"1360",height:"588"})),(0,r.kt)("p",null,"You want to be able to access port ",(0,r.kt)("inlineCode",{parentName:"p"},"5060")," from your local computer to connect to Routr using a SIPUA. We must create a port-forward from our local machine to the Gitpod workspace to do that."),(0,r.kt)("p",null,"To create the port forward, take the SSH connection string and add ",(0,r.kt)("inlineCode",{parentName:"p"},"-L 5060:localhost:5060")," to the end of the line. For example, your command might look like this:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"ssh <workspace-ssh-connection> -L 5060:localhost:5060\n")),(0,r.kt)("p",null,'Be sure to replace "workspace SSH connection" with your local connection.'),(0,r.kt)("p",null,"Here is an example of what the command might look like:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"ssh fonoster-routr-mn8nsx0d9px@fonoster-routr-mn8nsx0d9px.ssh.ws-us90.gitpod.io -L 5060:localhost:5060 \n")),(0,r.kt)("p",null,"This command forwards traffic from your local port ",(0,r.kt)("inlineCode",{parentName:"p"},"5060")," to your Gitpod workspace's port ",(0,r.kt)("inlineCode",{parentName:"p"},"5060"),", allowing you to connect via SIP."),(0,r.kt)("blockquote",null,(0,r.kt)("p",{parentName:"blockquote"},"Unfortunately, SSH does not natively support forwarding UDP traffic. It only provides port forwarding functionality for TCP connections. Therefore, you cannot enable UDP delivering directly with the previous SSH Command.")),(0,r.kt)("p",null,'This setup uses the "simpledata" implementation of the APIServer, which uses YAML files as the data source. Here is a list of the YAML files that make up the configuration:'),(0,r.kt)("p",null,(0,r.kt)("a",{parentName:"p",href:"https://github.com/fonoster/routr/blob/main/config/resources"},"https://github.com/fonoster/routr/blob/main/config/resources")),(0,r.kt)("p",null,"Feel free to explore these files and make changes as needed."))}d.isMDXComponent=!0},639:(e,t,o)=>{o.d(t,{Z:()=>n});const n=o.p+"assets/images/gitpod-account-keys-0833e0da64fdd0fa6867611cb583a0fc.png"},4635:(e,t,o)=>{o.d(t,{Z:()=>n});const n=o.p+"assets/images/gitpod-workspace-9a23cadbc9b3dfdfa8eda64fe4da4475.png"}}]);