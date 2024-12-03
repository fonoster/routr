"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[6541],{2539:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>c,contentTitle:()=>a,default:()=>h,frontMatter:()=>o,metadata:()=>i,toc:()=>l});const i=JSON.parse('{"id":"guides/routr-as-asterisk-frontend","title":"Routr as Asterisk frontend","description":"This guide explores the use case of using Asterisk merely as a Media Server and more specialized software, like Routr, to take care of the signaling and resource management. In other words, Asterisk is in charge of the IVR, voice mail, call recording, while Routr deals with connecting Agents, Peers, and Gateways. The following illustration depicts our scenario:","source":"@site/versioned_docs/version-1.x.x/guides/routr-as-asterisk-frontend.md","sourceDirName":"guides","slug":"/guides/routr-as-asterisk-frontend","permalink":"/docs/1.x.x/guides/routr-as-asterisk-frontend","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-1.x.x/guides/routr-as-asterisk-frontend.md","tags":[],"version":"1.x.x","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Basic Setup","permalink":"/docs/1.x.x/guides/basic-setup"},"next":{"title":"Running on Kubernetes","permalink":"/docs/1.x.x/guides/running-on-kubernetes"}}');var r=s(4848),t=s(8453);const o={},a="Routr as Asterisk frontend",c={},l=[{value:"Requirements",id:"requirements",level:2},{value:"Configuration Overview",id:"configuration-overview",level:2},{value:"Configuring Asterisk",id:"configuring-asterisk",level:2},{value:"Calling Asterisk from John&#39;s device",id:"calling-asterisk-from-johns-device",level:2},{value:"What&#39;s Next?",id:"whats-next",level:2}];function d(e){const n={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,t.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.header,{children:(0,r.jsx)(n.h1,{id:"routr-as-asterisk-frontend",children:"Routr as Asterisk frontend"})}),"\n",(0,r.jsx)(n.p,{children:"This guide explores the use case of using Asterisk merely as a Media Server and more specialized software, like Routr, to take care of the signaling and resource management. In other words, Asterisk is in charge of the IVR, voice mail, call recording, while Routr deals with connecting Agents, Peers, and Gateways. The following illustration depicts our scenario:"}),"\n",(0,r.jsx)("img",{src:"/img/peering_ilustration.png",width:"600",vspace:"50"}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Content"})}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsx)(n.li,{children:(0,r.jsx)(n.a,{href:"#requirements",children:"Requirements"})}),"\n",(0,r.jsx)(n.li,{children:(0,r.jsx)(n.a,{href:"#configuration-overview",children:"Configuration Overview"})}),"\n",(0,r.jsx)(n.li,{children:(0,r.jsx)(n.a,{href:"#configuring-asterisk",children:"Configuring Asterisk"})}),"\n",(0,r.jsx)(n.li,{children:(0,r.jsx)(n.a,{href:"#calling-asterisk-from-johns-device",children:"Calling Asterisk from John\u2019s device"})}),"\n",(0,r.jsx)(n.li,{children:(0,r.jsx)(n.a,{href:"#whats-next",children:"What\u2019s Next?"})}),"\n"]}),"\n",(0,r.jsx)(n.h2,{id:"requirements",children:"Requirements"}),"\n",(0,r.jsx)(n.p,{children:"This tutorial assumes the following:"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsx)(n.li,{children:"You have a SIP phone connected to the same LAN as Routr and Asterisk"}),"\n",(0,r.jsx)(n.li,{children:"If using a hardware phone, this can reach Asterisk and Routr and the other way around"}),"\n",(0,r.jsx)(n.li,{children:"You have a fresh installation of Routr and Asterisk"}),"\n"]}),"\n",(0,r.jsxs)(n.blockquote,{children:["\n",(0,r.jsxs)(n.p,{children:["Before starting this guide make sure to have a fresh installation of ",(0,r.jsx)(n.strong,{children:"Routr"})," server."]}),"\n"]}),"\n",(0,r.jsx)(n.h2,{id:"configuration-overview",children:"Configuration Overview"}),"\n",(0,r.jsxs)(n.p,{children:["With a fresh installation of ",(0,r.jsx)(n.strong,{children:"Routr"}),", you have most of the configuration you need to follow this tutorial. We, however, need to make some minor changes to configuration files to run our scenario."]}),"\n",(0,r.jsxs)(n.p,{children:["The first file we need to examine and change is ",(0,r.jsx)(n.code,{children:"config/peers.yml"}),'. Make a note of the username and secret for the Peer "ast" since we are using this to configure Asterisk. Also, search for the field ',(0,r.jsx)(n.code,{children:"spec.device"})," and change it to match the Agents domain(",(0,r.jsx)(n.code,{children:"sip.local"}),"). The file now looks similar to this:"]}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.code,{children:"config/peers.yml"})}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-yml",children:"- apiVersion: v1beta1\n  kind: Peer\n  metadata:\n    name: Asterisk PBX\n  spec:\n    device: 'sip.local'\n    credentials:\n      username: ast\n      secret: '1234'\n"})}),"\n",(0,r.jsxs)(n.p,{children:["Head to the console and run the command ",(0,r.jsx)(n.code,{children:"rctl -- get peers"})," to confirm that the Peer exist. The result should be as follows:"]}),"\n",(0,r.jsx)("img",{src:"/img/get_peers_cmd_output.png",width:"600"}),"\n",(0,r.jsxs)(n.p,{children:["Next, we focus our attention on ",(0,r.jsx)(n.code,{children:"domains.yml"})," and ",(0,r.jsx)(n.code,{children:"agents.yml"}),". With a fresh installation, we don't need to make any changes to these files. However, you could run the commands ",(0,r.jsx)(n.code,{children:"get domains"})," and ",(0,r.jsx)(n.code,{children:"get agents"})," to ensure that both, the Agent and the Domain, exist on the server. Your output should look similar to:"]}),"\n",(0,r.jsx)("img",{src:"/img/get_domains_and_agents.png",width:"600"}),"\n",(0,r.jsxs)(n.p,{children:["Use the information in ",(0,r.jsx)(n.code,{children:"agents.yml"})," to configure your SIP phone. The relevant information is found in ",(0,r.jsx)(n.code,{children:"spec.credentials"}),". Mine looks like this:"]}),"\n",(0,r.jsx)("img",{src:"/img/john_telephone_setup_general.png",width:"500"}),"\n",(0,r.jsx)("img",{src:"/img/john_telephone_setup_advanced.png",width:"500"}),"\n",(0,r.jsxs)(n.blockquote,{children:["\n",(0,r.jsx)(n.p,{children:"Make the adjustments based on your prefer SIP phone."}),"\n"]}),"\n",(0,r.jsxs)(n.p,{children:["You can verify that your device registered correctly with ",(0,r.jsx)(n.strong,{children:"Routr"})," by running the ",(0,r.jsx)(n.code,{children:"locate"})," command:"]}),"\n",(0,r.jsx)("img",{src:"/img/locate_john.png",width:"600"}),"\n",(0,r.jsx)(n.h2,{id:"configuring-asterisk",children:"Configuring Asterisk"}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Using PJSIP"})}),"\n",(0,r.jsxs)(n.p,{children:["Backup your ",(0,r.jsx)(n.code,{children:"pjsip.conf"})," and ",(0,r.jsx)(n.code,{children:"pjsip_wizard.conf"}),". Update your pjsip.conf with the following:"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{children:"[transport-tcp]\ntype=transport\nprotocol=tcp\nbind=0.0.0.0:6060\n"})}),"\n",(0,r.jsx)(n.p,{children:"Then, in your pjsip_wizard.conf:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{children:"[routr]\ntype = wizard\nsends_auth = yes\nsends_registrations = yes\nremote_hosts = 192.168.1.2\noutbound_auth/username = ast\noutbound_auth/password = 1234\nregistration/retry_interval = 10\nregistration/expiration = 900\nendpoint/allow = ulaw\nendpoint/allow = alaw\nendpoint/allow = opus\nendpoint/context = default\ntransport = transport-tcp\n"})}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:'Using the "old" Chan SIP'})}),"\n",(0,r.jsxs)(n.p,{children:["First backup your ",(0,r.jsx)(n.code,{children:"sip.conf"}),". Then, replace your configuration and edit the file to reflect the following:"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{children:"[general]\nudpbindaddr=0.0.0.0:6060\ncontext=default\nregister => ast:1234@192.168.1.2:5060/1001    ; This information must match the credentials in `config/peers.yml`\n"})}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Configuring the Dialplan"})}),"\n",(0,r.jsx)(n.p,{children:"We are going to use a very simple dialplan to play a sound file. Again, make a backup of your configuration and replace its content with this:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{children:"[default]\nexten => 1001,1,Answer\nexten => 1001,n,Playback(tt-monkeys)\nexten => 1001,n,Hangup\n"})}),"\n",(0,r.jsx)(n.p,{children:"Restart your Asterisk and check the location service. A new device now appears."}),"\n",(0,r.jsx)("img",{src:"/img/locate_john_and_ast.png",width:"600"}),"\n",(0,r.jsx)(n.h2,{id:"calling-asterisk-from-johns-device",children:"Calling Asterisk from John's device"}),"\n",(0,r.jsxs)(n.p,{children:["We can now call ",(0,r.jsx)(n.code,{children:"ast@sip.local"})," and if everything went well listen to a group of really annoying monkeys :)."]}),"\n",(0,r.jsx)(n.h2,{id:"whats-next",children:"What's Next?"}),"\n",(0,r.jsxs)(n.p,{children:["You can check out the ",(0,r.jsx)(n.a,{href:"https://github.com/fonoster../wiki/Home",children:"wiki"})," to see more examples. If you have any questions start an issue or contact us via:"]}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:["Twitter: ",(0,r.jsx)(n.a,{href:"https://twitter.com/fonoster",children:"@fonoster"})]}),"\n",(0,r.jsxs)(n.li,{children:["Email: ",(0,r.jsx)(n.a,{href:"mailto:fonosterteam@fonoster.com",children:"fonosterteam@fonoster.com"})]}),"\n"]})]})}function h(e={}){const{wrapper:n}={...(0,t.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(d,{...e})}):d(e)}},8453:(e,n,s)=>{s.d(n,{R:()=>o,x:()=>a});var i=s(6540);const r={},t=i.createContext(r);function o(e){const n=i.useContext(t);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:o(e.components),i.createElement(t.Provider,{value:n},e.children)}}}]);