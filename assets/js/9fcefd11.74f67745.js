"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[3102],{1318:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>i,default:()=>h,frontMatter:()=>a,metadata:()=>o,toc:()=>l});const o=JSON.parse('{"id":"development/quick-start","title":"Quick Start","description":"Before starting the development, you need to install the following tools:","source":"@site/docs/development/quick-start.md","sourceDirName":"development","slug":"/development/quick-start","permalink":"/docs/2.11.5/development/quick-start","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr-website/edit/main/docs/development/quick-start.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Introduction","permalink":"/docs/2.11.5/development/introduction"},"next":{"title":"Development with Gitpod","permalink":"/docs/2.11.5/development/development-mode-with-gitpod"}}');var r=t(4848),s=t(8453);const a={},i="Quick Start",c={},l=[{value:"Clone and Build the Project",id:"clone-and-build-the-project",level:2},{value:"Run the Project",id:"run-the-project",level:2}];function d(e){const n={a:"a",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",pre:"pre",ul:"ul",...(0,s.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.header,{children:(0,r.jsx)(n.h1,{id:"quick-start",children:"Quick Start"})}),"\n",(0,r.jsx)(n.p,{children:"Before starting the development, you need to install the following tools:"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsx)(n.li,{children:"NodeJS (>=16.14)"}),"\n",(0,r.jsx)(n.li,{children:"JDK (>=11)"}),"\n"]}),"\n",(0,r.jsxs)(n.p,{children:["For NodeJS, we recommend using ",(0,r.jsx)(n.a,{href:"https://github.com/nvm-sh/nvm",children:"nvm"})," to manage your NodeJS versions."]}),"\n",(0,r.jsx)(n.h2,{id:"clone-and-build-the-project",children:"Clone and Build the Project"}),"\n",(0,r.jsx)(n.p,{children:"To get started, first, clone the repository:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"git clone https://github.com/fonoster/routr\n"})}),"\n",(0,r.jsxs)(n.p,{children:["The previous command will create a directory called ",(0,r.jsx)(n.code,{children:"routr"})," with the project's source code."]}),"\n",(0,r.jsx)(n.p,{children:"Next, set the JAVA_HOME environment variable to the location of your JDK installation:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"export JAVA_HOME=/path/to/jdk\n"})}),"\n",(0,r.jsx)(n.p,{children:"Finally, build the project:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"cd routr\nnpm run make\n"})}),"\n",(0,r.jsx)(n.p,{children:"The previous command will install all the dependencies and build the project. If everything goes well, you should see no errors."}),"\n",(0,r.jsx)(n.h2,{id:"run-the-project",children:"Run the Project"}),"\n",(0,r.jsx)(n.p,{children:"To run all the components, you can use the following command:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"npm run start\n"})}),"\n",(0,r.jsx)(n.p,{children:"The previous command will start the EdgePort, Location Service, MessageDispatcher, Connect Processor, Requester, APIServer (simpledata), and Registry."}),"\n",(0,r.jsx)(n.p,{children:"As you change the source code, Nodemon will automatically restart the components except for the EdgePort and Requester, which are written in Java and require a manual build and restart."}),"\n",(0,r.jsx)(n.p,{children:"You also have the option to run each component individually. For example, if your use case only requires the EdgePort and the Location Service, you can run the following command:"}),"\n",(0,r.jsx)(n.p,{children:"In one terminal:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"npm run start:edgeport\n"})}),"\n",(0,r.jsx)(n.p,{children:"Example output:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"> start:edgeport\n> cross-env NODE_ENV=dev LOGS_LEVEL=verbose ./mods/edgeport/edgeport.sh\n\n2023-09-22 12:40:48.454 [info]: (edgeport) GRPCSipListener.java starting edgeport ref = edgeport-01 at 0.0.0.0\n2023-09-22 12:40:48.455 [info]: (edgeport) GRPCSipListener.java localnets list [127.0.0.1/8,10.111.221.2/24]\n2023-09-22 12:40:48.456 [info]: (edgeport) GRPCSipListener.java external hosts list [10.111.220.2,sip01.edgeport.net]\n2023-09-22 12:40:48.578 [info]: (edgeport) HealthCheck.java starting health check on port 8080 and endpoint /healthz\n"})}),"\n",(0,r.jsx)(n.p,{children:"In a separate terminal:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"npm run start:location\n"})}),"\n",(0,r.jsx)(n.p,{children:"Example output:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:'> start:location\n> cross-env NODE_ENV=dev LOGS_LEVEL=verbose CONFIG_PATH=$(pwd)/config/location.yaml nodemon mods/location/src/runner\n\n[nodemon] 2.0.20\n[nodemon] to restart at any time, enter `rs`\n[nodemon] watching path(s): mods/**/*\n[nodemon] watching extensions: ts\n[nodemon] starting `ts-node mods/location/src/runner.ts`\n2023-09-05 12:41:38.735 [info]: (location) using memory as cache provider {}\n2023-09-05 12:41:38.739 [info]: (common) starting routr service {"name":"location","bindAddr":"0.0.0.0:51902"}\n'})}),"\n",(0,r.jsxs)(n.p,{children:["Please see the ",(0,r.jsx)(n.code,{children:"scripts"})," section of ",(0,r.jsx)(n.a,{href:"https://github.com/fonoster/routr/blob/main/package.json",children:"package.json"})," for a complete list of available commands."]})]})}function h(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(d,{...e})}):d(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>a,x:()=>i});var o=t(6540);const r={},s=o.createContext(r);function a(e){const n=o.useContext(s);return o.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function i(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:a(e.components),o.createElement(s.Provider,{value:n},e.children)}}}]);