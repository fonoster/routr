"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[995],{3905:(e,n,t)=>{t.d(n,{Zo:()=>p,kt:()=>g});var o=t(7294);function r(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function a(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);n&&(o=o.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,o)}return t}function i(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?a(Object(t),!0).forEach((function(n){r(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):a(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function l(e,n){if(null==e)return{};var t,o,r=function(e,n){if(null==e)return{};var t,o,r={},a=Object.keys(e);for(o=0;o<a.length;o++)t=a[o],n.indexOf(t)>=0||(r[t]=e[t]);return r}(e,n);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(o=0;o<a.length;o++)t=a[o],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(r[t]=e[t])}return r}var c=o.createContext({}),s=function(e){var n=o.useContext(c),t=n;return e&&(t="function"==typeof e?e(n):i(i({},n),e)),t},p=function(e){var n=s(e.components);return o.createElement(c.Provider,{value:n},e.children)},u="mdxType",m={inlineCode:"code",wrapper:function(e){var n=e.children;return o.createElement(o.Fragment,{},n)}},d=o.forwardRef((function(e,n){var t=e.components,r=e.mdxType,a=e.originalType,c=e.parentName,p=l(e,["components","mdxType","originalType","parentName"]),u=s(t),d=r,g=u["".concat(c,".").concat(d)]||u[d]||m[d]||a;return t?o.createElement(g,i(i({ref:n},p),{},{components:t})):o.createElement(g,i({ref:n},p))}));function g(e,n){var t=arguments,r=n&&n.mdxType;if("string"==typeof e||r){var a=t.length,i=new Array(a);i[0]=d;var l={};for(var c in n)hasOwnProperty.call(n,c)&&(l[c]=n[c]);l.originalType=e,l[u]="string"==typeof e?e:r,i[1]=l;for(var s=2;s<a;s++)i[s]=t[s];return o.createElement.apply(null,i)}return o.createElement.apply(null,t)}d.displayName="MDXCreateElement"},6957:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>i,default:()=>m,frontMatter:()=>a,metadata:()=>l,toc:()=>s});var o=t(7462),r=(t(7294),t(3905));const a={},i="Concepts",l={unversionedId:"connect/concepts",id:"connect/concepts",title:"Concepts",description:"The Connect Mode is Routr's implementation of the SIPConnect standard. Routr introduces the Connect Processor and five routing types as part of the implementation.",source:"@site/docs/connect/concepts.md",sourceDirName:"connect",slug:"/connect/concepts",permalink:"/docs/2.0.0/connect/concepts",draft:!1,editUrl:"https://github.com/fonoster/routr-website/edit/main/docs/connect/concepts.md",tags:[],version:"current",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"Introduction",permalink:"/docs/2.0.0/connect/introduction"},next:{title:"Docker installation",permalink:"/docs/2.0.0/connect/quick-start/docker"}},c={},s=[{value:"Agent-to-Agent",id:"agent-to-agent",level:2},{value:"Agent-to-PSTN",id:"agent-to-pstn",level:2},{value:"From-PSTN",id:"from-pstn",level:2},{value:"Peer-to-PSTN",id:"peer-to-pstn",level:2},{value:"Agent-to-Peer",id:"agent-to-peer",level:2}],p={toc:s},u="wrapper";function m(e){let{components:n,...t}=e;return(0,r.kt)(u,(0,o.Z)({},p,t,{components:n,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"concepts"},"Concepts"),(0,r.kt)("p",null,"The Connect Mode is Routr's implementation of the SIPConnect standard. Routr introduces the Connect Processor and five routing types as part of the implementation."),(0,r.kt)("p",null,'The Connect Mode introduces the Connect Processor, a built-in Processor with the necessary logic to implement the "SIP Connect v1.1" specification.'),(0,r.kt)("p",null,"The following routing types are supported:"),(0,r.kt)("h2",{id:"agent-to-agent"},"Agent-to-Agent"),(0,r.kt)("p",null,"The ",(0,r.kt)("inlineCode",{parentName:"p"},"agent-to-agent")," routing type allows an Agent to call another Agent in the same Domain. The following yaml configuration shows a simple setup involving one Domain and two Agents:"),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Domain configuration")),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-yaml"},"- apiVersion: v2beta1\n  kind: Domain\n  ref: domain-01\n  metadata:\n    name: Local Domain\n  spec:\n    context:\n      domainUri: sip.local\n")),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Agents configuration")),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-yaml"},'- apiVersion: v2beta1\n  kind: Agent\n  ref: agent-01\n  metadata:\n    name: John Doe\n  spec:\n    username: "1001"\n    domainRef: domain-01\n    credentialsRef: credentials-01\n\n- apiVersion: v2beta1\n  kind: Agent\n  ref: agent-02\n  metadata:\n    name: Jane Doe\n  spec:\n    username: "1002"\n    domainRef: domain-01\n    credentialsRef: credentials-02\n')),(0,r.kt)("p",null,"With the configuration above, John and Jane can call each other using their usernames."),(0,r.kt)("blockquote",null,(0,r.kt)("p",{parentName:"blockquote"},"Here, we are showing the yaml representation of the resources for illustration purposes. However, we typically use the CTL or the SDK to create resources.")),(0,r.kt)("h2",{id:"agent-to-pstn"},"Agent-to-PSTN"),(0,r.kt)("p",null,"In the Connect Mode, the ",(0,r.kt)("inlineCode",{parentName:"p"},"agent-to-pstn")," routing type allows an Agent to call numbers in the Private Switch Telephone Network (PSTN) using a Number and Trunking."),(0,r.kt)("p",null,"The ",(0,r.kt)("inlineCode",{parentName:"p"},"egressPolicies")," section of the Domain resource handles the routing. The examples below show how these resources relate to each other."),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Domain configuration")),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-yaml"},'- apiVersion: v2beta1\n  kind: Domain\n  ref: domain-01\n  metadata:\n    name: Local Domain\n  spec:\n    accessControlListRef: acl-01\n    context:\n      domainUri: sip.local\n      egressPolicies:\n        - rule: ".*"\n          numberRef: number-01\n')),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Number configuration")),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-yaml"},'- apiVersion: v2beta1\n  kind: Number\n  ref: number-01\n  metadata:\n    name: "(910)343-4434"\n    geoInfo:\n      city: Durham, NC\n      country: USA\n      countryISOCode: US\n  spec:\n    trunkRef: trunk-01\n    location:\n      telUrl: tel:+19103434434\n')),(0,r.kt)("p",null,"With the previous configuration, any Agent in the Domain can call the PSTN using the Number ",(0,r.kt)("inlineCode",{parentName:"p"},"(910)343-4434"),"."),(0,r.kt)("h2",{id:"from-pstn"},"From-PSTN"),(0,r.kt)("p",null,"The ",(0,r.kt)("inlineCode",{parentName:"p"},"from-pstn")," routing type outlines how a call from the PSTN connects to an Agent or a Peer using a Number and Trunking. The ",(0,r.kt)("inlineCode",{parentName:"p"},"location")," section of the Number resource manages this routing. For instance, to route calls from the PSTN to an Agent, you can use the following configuration:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-yaml"},'- apiVersion: v2beta1\n  kind: Number\n  ref: number-01\n  metadata:\n    name: "(910)343-4434"\n    geoInfo:\n      city: Durham, NC\n      country: USA\n      countryISOCode: US\n  spec:\n    trunkRef: trunk-01\n    location:\n      telUrl: tel:+19103434434\n      aorLink: sip:john@sip.local\n')),(0,r.kt)("p",null,"You can apply the same configuration to route calls from the PSTN to a Peer. For instance, to direct calls from the PSTN to an Asterisk server, you can adopt this configuration, provided the endpoint is registered with Routr."),(0,r.kt)("h2",{id:"peer-to-pstn"},"Peer-to-PSTN"),(0,r.kt)("p",null,"The ",(0,r.kt)("inlineCode",{parentName:"p"},"peer-to-pstn")," routing type describes how a Peer such as Asterisk can reach the PSTN. Unlike ",(0,r.kt)("inlineCode",{parentName:"p"},"agent-to-pstn"),", this routing is not bound to a Domain. Because Peers are trusted entities, they can call the PSTN using the ",(0,r.kt)("inlineCode",{parentName:"p"},"Trunking")," resource. This routing type is automatically selected when the number dialed by the Peer is not in the location table."),(0,r.kt)("h2",{id:"agent-to-peer"},"Agent-to-Peer"),(0,r.kt)("p",null,'This routing type allows any Agent to call a Peer. Because the Agent is going "outside" of the Domain\'s boundaries, the Agent must have a valid JWT token in the ',(0,r.kt)("inlineCode",{parentName:"p"},"X-Connect-Token")," header. Incidentally, required claims in the JWT token include fields similar to the ",(0,r.kt)("inlineCode",{parentName:"p"},"Agent")," resource. Here is an example of the payload of a JWT token:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n  "ref": "agent-01",\n  "domainRef": "domain-01",\n  "aor": "sip:1001@sip.local",\n  "aorLink": "asterisk@default",\n  "domain": "sip.local",\n  "privacy": "NONE",\n  "allowedMethods": ["INVITE", "REGISTER"]\n}\n')))}m.isMDXComponent=!0}}]);