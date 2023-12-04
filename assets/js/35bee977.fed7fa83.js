"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[1790],{3905:(e,n,t)=>{t.d(n,{Zo:()=>u,kt:()=>g});var a=t(7294);function o(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function i(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);n&&(a=a.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,a)}return t}function r(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?i(Object(t),!0).forEach((function(n){o(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):i(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function l(e,n){if(null==e)return{};var t,a,o=function(e,n){if(null==e)return{};var t,a,o={},i=Object.keys(e);for(a=0;a<i.length;a++)t=i[a],n.indexOf(t)>=0||(o[t]=e[t]);return o}(e,n);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(a=0;a<i.length;a++)t=i[a],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(o[t]=e[t])}return o}var s=a.createContext({}),p=function(e){var n=a.useContext(s),t=n;return e&&(t="function"==typeof e?e(n):r(r({},n),e)),t},u=function(e){var n=p(e.components);return a.createElement(s.Provider,{value:n},e.children)},m="mdxType",c={inlineCode:"code",wrapper:function(e){var n=e.children;return a.createElement(a.Fragment,{},n)}},d=a.forwardRef((function(e,n){var t=e.components,o=e.mdxType,i=e.originalType,s=e.parentName,u=l(e,["components","mdxType","originalType","parentName"]),m=p(t),d=o,g=m["".concat(s,".").concat(d)]||m[d]||c[d]||i;return t?a.createElement(g,r(r({ref:n},u),{},{components:t})):a.createElement(g,r({ref:n},u))}));function g(e,n){var t=arguments,o=n&&n.mdxType;if("string"==typeof e||o){var i=t.length,r=new Array(i);r[0]=d;var l={};for(var s in n)hasOwnProperty.call(n,s)&&(l[s]=n[s]);l.originalType=e,l[m]="string"==typeof e?e:o,r[1]=l;for(var p=2;p<i;p++)r[p]=t[p];return a.createElement.apply(null,r)}return a.createElement.apply(null,t)}d.displayName="MDXCreateElement"},7010:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>s,contentTitle:()=>r,default:()=>c,frontMatter:()=>i,metadata:()=>l,toc:()=>p});var a=t(7462),o=(t(7294),t(3905));const i={sidebar_position:2},r="Concepts",l={unversionedId:"concepts",id:"version-1.x.x/concepts",title:"Concepts",description:"The following are some key concepts, including some of the essential routing strategies implemented in Routr.",source:"@site/versioned_docs/version-1.x.x/concepts.md",sourceDirName:".",slug:"/concepts",permalink:"/docs/1.x.x/concepts",draft:!1,editUrl:"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-1.x.x/concepts.md",tags:[],version:"1.x.x",sidebarPosition:2,frontMatter:{sidebar_position:2},sidebar:"tutorialSidebar",previous:{title:"Test Plan",permalink:"/docs/1.x.x/introduction/test-plan"},next:{title:"Cheatsheet",permalink:"/docs/1.x.x/administration/cli/cheatsheet"}},s={},p=[{value:"Intra-Domain Routing",id:"intra-domain-routing",level:2},{value:"Double Agents",id:"double-agents",level:3},{value:"Single Domain Example",id:"single-domain-example",level:3},{value:"Domain Ingress Routing",id:"domain-ingress-routing",level:2},{value:"Domain Egress Routing",id:"domain-egress-routing",level:2},{value:"Peers Routing",id:"peers-routing",level:2}],u={toc:p},m="wrapper";function c(e){let{components:n,...t}=e;return(0,o.kt)(m,(0,a.Z)({},u,t,{components:n,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"concepts"},"Concepts"),(0,o.kt)("p",null,"The following are some key concepts, including some of the essential routing strategies implemented in Routr."),(0,o.kt)("h2",{id:"intra-domain-routing"},"Intra-Domain Routing"),(0,o.kt)("p",null,(0,o.kt)("em",{parentName:"p"},"Intra-Domain Routing(IDR)")," offers a mechanism for user segmentation. For a small or medium size company, a single domain may be sufficient, but for a multinational or an IP telephony service provider, it may not."),(0,o.kt)("p",null,"For a small company with less than 50 users, you may define a domain ",(0,o.kt)("inlineCode",{parentName:"p"},"sip.domain.com"),". Regardless of how many offices they have, the chances are that they still need to communicate with each other, and therefore we keep them in the same Domain. Needless to say, that in a company this size you are not going to run out usernames."),(0,o.kt)("p",null,"A multinational company like ",(0,o.kt)("em",{parentName:"p"},"Walmart")," have thousands of stores that operate independently. In such a case, you need a multi-domain setting. For example, you may define the domains ",(0,o.kt)("inlineCode",{parentName:"p"},"sip.0001.walmart.com")," and ",(0,o.kt)("inlineCode",{parentName:"p"},"sip.0002.walmart.com"),", and... you get the idea."),(0,o.kt)("h3",{id:"double-agents"},"Double Agents"),(0,o.kt)("img",{src:"https://raw.githubusercontent.com/wiki/fonoster/routr/images/double_agent.png",width:"400"}),(0,o.kt)("br",null),(0,o.kt)("br",null),(0,o.kt)("p",null,"Yes, you can have double Agents, or Agents that exist in a multi-domain setup. For this to work, you need to do is include the Domain in the Agent's ",(0,o.kt)("inlineCode",{parentName:"p"},"spec.domain[*]")," list. In the example before, John can send or receive calls from both domains, while the rest of the Agents are only allowed to call within the Domain."),(0,o.kt)("h3",{id:"single-domain-example"},"Single Domain Example"),(0,o.kt)("p",null,"The following yaml configuration shows a simple setup, involving one Domain and two Agents:"),(0,o.kt)("p",null,(0,o.kt)("strong",{parentName:"p"},"Domain configuration")),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-yaml"},"- apiVersion: v1beta1\n  kind: Domain\n  metadata:\n    name: Local Office\n  spec:\n    context:\n      domainUri: sip.local\n")),(0,o.kt)("p",null,(0,o.kt)("strong",{parentName:"p"},"Agents configuration")),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-yaml"},"- apiVersion: v1beta1\n  kind: Agent\n  metadata:\n    name: John Doe\n  spec:\n    credentials:\n      username: john\n      secret: '1234'\n    domains: [sip.local]\n- kind: Agent\n  apiVersion: v1beta1\n  metadata:\n    name: Janie Doe\n  spec:\n    credentials:\n      username: janie\n      secret: '1234'\n    domains: [sip.local]\n")),(0,o.kt)("p",null,' Voila! That\'s all the configuration you need for intra-domain communication. For calls outside the Domain, see "Domain Egress Routing" section and to receive calls from the PSTN check section "Domain Ingress Routing."'),(0,o.kt)("blockquote",null,(0,o.kt)("p",{parentName:"blockquote"},"To configure your sip devices use the information found in ",(0,o.kt)("inlineCode",{parentName:"p"},"config/agents.yml"),". Also, you must use the Host/IP of Routr server as\nthe OUTBOUND PROXY of your sip device.")),(0,o.kt)("p",null,(0,o.kt)("strong",{parentName:"p"},"Routing Rules")),(0,o.kt)("p",null,"The following rules apply to Intra-Domain Routing:"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},"Agents can only call other Agents in the same Domain"),(0,o.kt)("li",{parentName:"ul"},"Agents must belong to a Domain"),(0,o.kt)("li",{parentName:"ul"},"Agents Are not allowed to send a Digest username different than the username in the ",(0,o.kt)("inlineCode",{parentName:"li"},"From-Header"))),(0,o.kt)("h2",{id:"domain-ingress-routing"},"Domain Ingress Routing"),(0,o.kt)("p",null,"In Routr, the process of receiving a call from PSTN to a Domain is as ",(0,o.kt)("em",{parentName:"p"},"Domain Ingress Routing(DIR)")," and it is done using a Gateway resource. The yaml file ",(0,o.kt)("inlineCode",{parentName:"p"},"config/gateways.yml")," contains the Gateways. The following example shows a typical Gateway configuration."),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-yaml"},"- apiVersion: v1beta1\n  kind: Gateway\n  metadata:\n    name: Plain Old Phone Service Provider\n  spec:\n    regService:\n      host: sip.provider.net\n      credentials:\n        username: 'gwuser'\n        secret: gwsecret\n      transport: udp\n      registries: [sip.nyc.provider.net] # These are additional registrars within the provider's network\n")),(0,o.kt)("p",null,"You also need to define Numbers. Routr uses the Address Of Record(AOR) to routes incoming calls from a Number  to an existing Agent or Peer. The AOR must be available in the location service at the time of the call, or the call gets rejected."),(0,o.kt)("p",null,"Please examine the following example:"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-yaml"},"- apiVersion: v1beta1\n  kind: Number\n  metadata:\n    gwRef: dd50baa4\n    geoInfo:\n      city: Columbus, GA\n      country: USA\n      countryISOCode: US\n  spec:\n    location:\n      telUri: 'tel:17066041487'\n      aorLink: 'sip:john@sip.local' # This is the sip uri of an agent that is expected to be logged in\n")),(0,o.kt)("p",null,'Easy right? Any incoming call is routed from this Gateway and Number to "Jhon Doe" @ Ocean New York.'),(0,o.kt)("p",null,(0,o.kt)("strong",{parentName:"p"},"Routing Rules")),(0,o.kt)("p",null,"The ",(0,o.kt)("inlineCode",{parentName:"p"},"spec.location")," block of a ",(0,o.kt)("inlineCode",{parentName:"p"},"Number")," resource configuration, determines the path of an inbound call from the PSTN. The ",(0,o.kt)("inlineCode",{parentName:"p"},"aorLink")," refers to an Address of Record(Agent or Peer) that is available in the ",(0,o.kt)("inlineCode",{parentName:"p"},"location service"),"."),(0,o.kt)("h2",{id:"domain-egress-routing"},"Domain Egress Routing"),(0,o.kt)("p",null,(0,o.kt)("em",{parentName:"p"},"Domain Egress Routing(DER)")," is the way that ",(0,o.kt)("strong",{parentName:"p"},"Routr")," deals with a call request to a ",(0,o.kt)("em",{parentName:"p"},"callee")," that exists in the Public Switched Telephone Network(PSTN) and not in the ",(0,o.kt)("em",{parentName:"p"},"callers'")," Domain. The EgressPolicy consists of a ",(0,o.kt)("inlineCode",{parentName:"p"},"rule"),", and a ",(0,o.kt)("inlineCode",{parentName:"p"},"numberRef")," defined in the ",(0,o.kt)("inlineCode",{parentName:"p"},"spec.context")," section of ",(0,o.kt)("inlineCode",{parentName:"p"},"Domains")," resources."),(0,o.kt)("p",null,"The ",(0,o.kt)("inlineCode",{parentName:"p"},"rule")," and ",(0,o.kt)("inlineCode",{parentName:"p"},"numberRef")," is defined as follows:"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("p",{parentName:"li"},(0,o.kt)("inlineCode",{parentName:"p"},"rule")," is a regex to match callee in the call request. The location service uses this only after a search in the caller's Domain first.")),(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("p",{parentName:"li"},(0,o.kt)("inlineCode",{parentName:"p"},"numberRef")," is the identifier of the Number that will to route the call. The Number must already exist and have a parent Gateway."))),(0,o.kt)("p",null,(0,o.kt)("strong",{parentName:"p"},"Routing Rules")),(0,o.kt)("p",null,"Agents can only perform outbound calls using the ",(0,o.kt)("inlineCode",{parentName:"p"},"Egress Policy")," of their Domains."),(0,o.kt)("h2",{id:"peers-routing"},"Peers Routing"),(0,o.kt)("p",null,"Peers are very similar to Agents, but they are not bound to any Domain, and usually, collocated in the same network with Routr. A typical case is peering with Asterisk, where Asterisk acts as a Media Server and Routr provides the signaling."),(0,o.kt)("p",null,"Peers can perform inbound/outbound signaling within the network without any special consideration since they exist inside the ",(0,o.kt)("em",{parentName:"p"},"Location Service")," just like Agents. So it is possible to perform signaling from Peer to Peer, Peer to Agent."),(0,o.kt)("p",null,"The same is true for Inbound from the PSTN. For example, we can redirect incoming calls from the PSTN using the ",(0,o.kt)("inlineCode",{parentName:"p"},"spec.location")," settings in the ",(0,o.kt)("inlineCode",{parentName:"p"},"numbers.yml")," configuration file."),(0,o.kt)("p",null,(0,o.kt)("strong",{parentName:"p"},"Routing Rules")),(0,o.kt)("p",null,"Agents are not allowed to call Peers."),(0,o.kt)("blockquote",null,(0,o.kt)("p",{parentName:"blockquote"},"A future version of the ",(0,o.kt)("inlineCode",{parentName:"p"},"Peer resource")," might feature a ",(0,o.kt)("inlineCode",{parentName:"p"},"spec.acceptFrom.*")," field to allow calls from Domains or specific Agents.")))}c.isMDXComponent=!0}}]);