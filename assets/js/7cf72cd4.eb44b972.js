"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[8937],{3689:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>o,contentTitle:()=>c,default:()=>a,frontMatter:()=>i,metadata:()=>t,toc:()=>l});const t=JSON.parse('{"id":"development/components/apiserver","title":"APIServer","description":"The APIServer is an optional component that can be used to describe a VoIP network in terms of Domains, Agents, Trunks, Numbers, and Peers. The data is stored in a PostgreSQL database and is accessed by other components via gRPC.","source":"@site/docs/development/components/apiserver.md","sourceDirName":"development/components","slug":"/development/components/apiserver","permalink":"/docs/2.11.5/development/components/apiserver","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr/edit/main/docs/docs/docs/development/components/apiserver.md","tags":[],"version":"current","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"RTPRelay","permalink":"/docs/2.11.5/development/components/rtprelay"},"next":{"title":"SimpleAuth Service","permalink":"/docs/2.11.5/development/components/simpleauth"}}');var r=s(4848),d=s(8453);const i={},c="APIServer",o={},l=[{value:"Configuration Spec",id:"configuration-spec",level:2},{value:"Communication and Protobuf Spec",id:"communication-and-protobuf-spec",level:2},{value:"Launching the APIServer",id:"launching-the-apiserver",level:2},{value:"Quick Test with gRPCurl",id:"quick-test-with-grpcurl",level:2}];function h(e){const n={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,d.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.header,{children:(0,r.jsx)(n.h1,{id:"apiserver",children:"APIServer"})}),"\n",(0,r.jsx)(n.p,{children:"The APIServer is an optional component that can be used to describe a VoIP network in terms of Domains, Agents, Trunks, Numbers, and Peers. The data is stored in a PostgreSQL database and is accessed by other components via gRPC."}),"\n",(0,r.jsxs)(n.p,{children:["The APIServer has two implementations: the ",(0,r.jsx)(n.code,{children:"pgdata"})," for persistent data storage in a PostgreSQL database and the ",(0,r.jsx)(n.code,{children:"simpledata"})," for storing data in files. The ",(0,r.jsx)(n.code,{children:"simpledata"})," implementation is intended for testing and small deployments."]}),"\n",(0,r.jsxs)(n.p,{children:["The ",(0,r.jsx)(n.code,{children:"pgdata"})," has several advantages over the ",(0,r.jsx)(n.code,{children:"simpledata"})," implementation. The first advantage is that the ",(0,r.jsx)(n.code,{children:"pgdata"})," allows you to manage the data using the CTL and SDK. Additionally, all the data entities support the ",(0,r.jsx)(n.code,{children:"extended"})," attribute, enabling you to store additional data in the database in JSON format\u2014more on this in later sections."]}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"Data Migration"})}),"\n",(0,r.jsxs)(n.p,{children:["The ",(0,r.jsx)(n.code,{children:"pgdata"})," implementation uses ",(0,r.jsx)(n.a,{href:"https://www.prisma.io/",children:"Prisma"})," to manage the database schema. Prisma is important because it allows us to migrate the database schema to newer versions of Routr easily."]}),"\n",(0,r.jsx)(n.h2,{id:"configuration-spec",children:"Configuration Spec"}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"pgdata"})}),"\n",(0,r.jsxs)(n.p,{children:["The ",(0,r.jsx)(n.code,{children:"pgdata"})," has the following environment variables available for configuration:"]}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"DATABASE_URL"})," - The URL of the PostgreSQL database. Example: ",(0,r.jsx)(n.code,{children:"postgresql://postgres:postgres@localhost:5432/routr"})]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"BIND_ADDR"})," - The address where the APIServer will listen for gRPC requests. Default to ",(0,r.jsx)(n.code,{children:"0.0.0.0:51907"})]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"EXTERNAL_SERVER_BIND_ADDR"})," - The address where the APIServer will listen for HTTP requests. Default to ",(0,r.jsx)(n.code,{children:"0.0.0.0:51908"})]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"TLS_ON"})," - Enables TLS for the gRPC server. Default to ",(0,r.jsx)(n.code,{children:"false"})]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"VERIFY_CLIENT_CERT"})," - Enables client certificate verification. Default to ",(0,r.jsx)(n.code,{children:"false"})]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"CACERT"})," - The path to the CA certificate. Default to ",(0,r.jsx)(n.code,{children:"/etc/routr/certs/ca.crt"})]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"SERVER_CERT"})," - The path to the server certificate. Default to ",(0,r.jsx)(n.code,{children:"/etc/routr/certs/server.crt"})]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"ENFORCE_E164"})," - Enables E164 validation for Numbers. Default to ",(0,r.jsx)(n.code,{children:"false"})]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"ENFORCE_E164_WITH_MOBILE_PREFIX"})," - Enables E164 validation for Numbers with mobile prefixes. Default to ",(0,r.jsx)(n.code,{children:"false"})]}),"\n"]}),"\n",(0,r.jsxs)(n.p,{children:["For details about connecting to the ",(0,r.jsx)(n.code,{children:"pgdata"})," to manage the data, see the ",(0,r.jsx)(n.a,{href:"/docs/2.11.5/connect/command-line/overview",children:"CTL"})," and ",(0,r.jsx)(n.a,{href:"/docs/2.11.5/connect/nodesdk/overview",children:"SDK"})," documentation."]}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"simpledata"})}),"\n",(0,r.jsxs)(n.p,{children:["The ",(0,r.jsx)(n.code,{children:"simpledata"})," has the following environment variables available for configuration:"]}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"PATH_TO_RESOURCES"})," - The path to the directory where the data will be stored. Example: ",(0,r.jsx)(n.code,{children:"/etc/routr/resources"})]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"BIND_ADDR"})," - The address where the APIServer will listen for gRPC requests. Default to ",(0,r.jsx)(n.code,{children:"0.0.0.0:51907"})]}),"\n"]}),"\n",(0,r.jsx)(n.p,{children:"Both implementations provide Routr with the same protobuf interface, so you can switch between them without changing the other components."}),"\n",(0,r.jsx)(n.p,{children:"In your resources directory, you will find the following files:"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"agents.yaml"})," - A list of Agents"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"domains.yaml"})," - A list of Domains to which Agents belong"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"trunks.yaml"})," - Represents the list of Trunks"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"numbers.yaml"})," - A list of Numbers to which Trunks belong"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"peers.yaml"})," - A list of Peers that cooperate with Routr (e.g., Asterisk, FreeSWITCH, etc.)"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"credentials.yaml"})," - A list of Credentials for Peers and Agents"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"acl.yaml"})," - The list of ACLs"]}),"\n"]}),"\n",(0,r.jsxs)(n.blockquote,{children:["\n",(0,r.jsxs)(n.p,{children:["You may also provide a ",(0,r.jsx)(n.code,{children:".json"})," file instead of a ",(0,r.jsx)(n.code,{children:".yaml"})," file."]}),"\n"]}),"\n",(0,r.jsx)(n.p,{children:"The Agents configuration file has the following structure:"}),"\n",(0,r.jsxs)(n.table,{children:[(0,r.jsx)(n.thead,{children:(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.th,{children:"Property"}),(0,r.jsx)(n.th,{children:"Description"}),(0,r.jsx)(n.th,{children:"Required"})]})}),(0,r.jsxs)(n.tbody,{children:[(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"apiVersion"})}),(0,r.jsx)(n.td,{children:"The API version of the Agent"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"kind"})}),(0,r.jsx)(n.td,{children:"The kind of resource"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"ref"})}),(0,r.jsx)(n.td,{children:"Reference to the Agent"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.name"})}),(0,r.jsx)(n.td,{children:"A friendly name for the Agent"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.username"})}),(0,r.jsx)(n.td,{children:"The username of the Agent"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.domainRef"})}),(0,r.jsx)(n.td,{children:"Reference to the Domain of the Agent"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.credentialsRef"})}),(0,r.jsx)(n.td,{children:"Reference to the Credentials of the Agent"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.privacy"})}),(0,r.jsxs)(n.td,{children:["The privacy settings of the Agent (",(0,r.jsx)(n.code,{children:"Private"})," or ",(0,r.jsx)(n.code,{children:"None"}),")"]}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.enabled"})}),(0,r.jsx)(n.td,{children:"The enabled status of the Agent (reserved for future use)"}),(0,r.jsx)(n.td,{children:"No"})]})]})]}),"\n",(0,r.jsx)(n.p,{children:"An example of an Agents configuration file:"}),"\n",(0,r.jsxs)(n.p,{children:["Filename: ",(0,r.jsx)(n.code,{children:"agents.yaml"})]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-yaml",children:'- apiVersion: v2beta1\n  kind: Agent\n  ref: agent-01\n  metadata:\n    name: John Doe\n  spec:\n    username: "1001"\n    domainRef: domain-01\n    credentialsRef: credentials-01\n    privacy: Private\n'})}),"\n",(0,r.jsxs)(n.p,{children:["In the example above, the Agent ",(0,r.jsx)(n.code,{children:"agent-01"})," has the username ",(0,r.jsx)(n.code,{children:"1001"}),", belongs to the Domain ",(0,r.jsx)(n.code,{children:"domain-01"}),", and uses the Credentials ",(0,r.jsx)(n.code,{children:"credentials-01"}),". Both the Domain and the Credentials are required for the Agent to work."]}),"\n",(0,r.jsx)(n.p,{children:"The Domains configuration file has the following structure:"}),"\n",(0,r.jsxs)(n.table,{children:[(0,r.jsx)(n.thead,{children:(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.th,{children:"Property"}),(0,r.jsx)(n.th,{children:"Description"}),(0,r.jsx)(n.th,{children:"Required"})]})}),(0,r.jsxs)(n.tbody,{children:[(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"apiVersion"})}),(0,r.jsx)(n.td,{children:"The API version of the Domain"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"kind"})}),(0,r.jsx)(n.td,{children:"The kind of resource"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"ref"})}),(0,r.jsx)(n.td,{children:"Reference to the Domain"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.name"})}),(0,r.jsx)(n.td,{children:"A friendly name for the Domain"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.context.domainUri"})}),(0,r.jsx)(n.td,{children:"The domain URI"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.context.egressPolicies"})}),(0,r.jsx)(n.td,{children:"The list of egress policies"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.context.egressPolicies[*].rule"})}),(0,r.jsx)(n.td,{children:"The regular expression to match the number"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.context.egressPolicies[*].numberRef"})}),(0,r.jsx)(n.td,{children:"Reference to the Number"}),(0,r.jsx)(n.td,{children:"Yes"})]})]})]}),"\n",(0,r.jsx)(n.p,{children:"An example of a Domains configuration file:"}),"\n",(0,r.jsxs)(n.p,{children:["Filename: ",(0,r.jsx)(n.code,{children:"domains.yaml"})]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-yaml",children:'- apiVersion: v2beta1\n  kind: Domain\n  ref: domain-01\n  metadata:\n    name: Local Domain\n  spec:\n    context:\n      domainUri: sip.local\n      egressPolicies:\n        - rule: ".*"\n          numberRef: number-01\n'})}),"\n",(0,r.jsxs)(n.p,{children:["In the example above, the Domain ",(0,r.jsx)(n.code,{children:"domain-01"})," has the Domain URI ",(0,r.jsx)(n.code,{children:"sip.local"})," and the egress policy ",(0,r.jsx)(n.code,{children:".*"})," that matches all numbers. The egress policy is associated with the Number ",(0,r.jsx)(n.code,{children:"number-01"}),". The Number ",(0,r.jsx)(n.code,{children:"number-01"})," is required for the Domain to work."]}),"\n",(0,r.jsx)(n.p,{children:"Numbers are used to route calls from and to the PSTN. The Numbers configuration file has the following structure:"}),"\n",(0,r.jsxs)(n.table,{children:[(0,r.jsx)(n.thead,{children:(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.th,{children:"Property"}),(0,r.jsx)(n.th,{children:"Description"}),(0,r.jsx)(n.th,{children:"Required"})]})}),(0,r.jsxs)(n.tbody,{children:[(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"apiVersion"})}),(0,r.jsx)(n.td,{children:"The API version of the Number"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"kind"})}),(0,r.jsx)(n.td,{children:"The kind of resource"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"ref"})}),(0,r.jsx)(n.td,{children:"Reference to the Number"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.name"})}),(0,r.jsx)(n.td,{children:"A friendly name for the Number"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.geoInfo.city"})}),(0,r.jsx)(n.td,{children:"The city where the Number is located"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.geoInfo.country"})}),(0,r.jsx)(n.td,{children:"The country where the Number is located"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.geoInfo.countryIsoCode"})}),(0,r.jsx)(n.td,{children:"The ISO code of the country"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.trunkRef"})}),(0,r.jsx)(n.td,{children:"Reference to the Trunk"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.location.telUrl"})}),(0,r.jsx)(n.td,{children:"The tel URL of the Number"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.location.aorLink"})}),(0,r.jsx)(n.td,{children:"The Address of Record (AOR) of the Number"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.location.sessionAffinityHeader"})}),(0,r.jsx)(n.td,{children:"The session affinity header of the Number"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.location.extraHeaders"})}),(0,r.jsx)(n.td,{children:"The extra headers of the Number"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.location.extraHeaders[*].name"})}),(0,r.jsx)(n.td,{children:"The name of the extra header"}),(0,r.jsx)(n.td,{children:"Yes"})]})]})]}),"\n",(0,r.jsxs)(n.p,{children:["Tthe ' tel: ' scheme is required when setting the ",(0,r.jsx)(n.code,{children:"spec.location.telUrl"})," property. For example, ",(0,r.jsx)(n.code,{children:"tel:+17066041487"}),". Here, ",(0,r.jsx)(n.code,{children:"tel:"})," indicates that the URI is a telephone number. Please remember that it must match the number sent by your VoIP provider."]}),"\n",(0,r.jsxs)(n.p,{children:["Another important property is the ",(0,r.jsx)(n.code,{children:"spec.location.aorLink"}),". The important thing is that the AOR must be present in the location table in the Location Service. Otherwise, the call will fail. The AOR can be a SIP URI or a backend URI. Typically, you will use SIP URIs to route calls to Agents and backend URIs to route calls to Peers."]}),"\n",(0,r.jsxs)(n.p,{children:["The ",(0,r.jsx)(n.code,{children:"spec.location.sessionAffinityHeader"}),' tells the Location Service to use a specific header to identify the session. This property is helpful in combination with "backend" URIs. For example, if you have a conference server and want to ensure that all calls to the same conference room are routed to the same server, you can use the ',(0,r.jsx)(n.code,{children:"X-Room-Id"})," header to identify the session. The Location Service will use the header's value to identify the session."]}),"\n",(0,r.jsx)(n.p,{children:"An example of a Numbers configuration file:"}),"\n",(0,r.jsxs)(n.p,{children:["Filename: ",(0,r.jsx)(n.code,{children:"numbers.yaml"})]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-yaml",children:'- apiVersion: v2beta1\n  kind: Number\n  ref: number-01\n  metadata:\n    name: "(706)604-1487"\n    geoInfo:\n      city: Columbus, GA\n      country: USA\n      countryIsoCode: US\n  spec:\n    trunkRef: trunk-01\n    location:\n      telUrl: tel:+17066041487\n      aorLink: sip:conference@sip.local\n      sessionAffinityHeader: X-Room-Id\n      extraHeaders:\n        - name: X-Room-Id\n          value: jsa-shqm-iyo\n'})}),"\n",(0,r.jsx)(n.p,{children:"Numbers must be associated with a Trunk to work."}),"\n",(0,r.jsx)(n.p,{children:"The Trunks configuration file has the following structure:"}),"\n",(0,r.jsxs)(n.table,{children:[(0,r.jsx)(n.thead,{children:(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.th,{children:"Property"}),(0,r.jsx)(n.th,{children:"Description"}),(0,r.jsx)(n.th,{children:"Required"})]})}),(0,r.jsxs)(n.tbody,{children:[(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"apiVersion"})}),(0,r.jsx)(n.td,{children:"The API version of the Trunk"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"kind"})}),(0,r.jsx)(n.td,{children:"The kind of resource"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"ref"})}),(0,r.jsx)(n.td,{children:"Reference to the Trunk"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.name"})}),(0,r.jsx)(n.td,{children:"A friendly name for the Trunk"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.region"})}),(0,r.jsx)(n.td,{children:"Reserved for future use"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.inbound.uri"})}),(0,r.jsx)(n.td,{children:"The inbound URI of the Trunk"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.inbound.accessControlListRef"})}),(0,r.jsx)(n.td,{children:"Reference to the ACL of the Trunk"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.sendRegister"})}),(0,r.jsx)(n.td,{children:"Enables outbound registration"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.credentialsRef"})}),(0,r.jsx)(n.td,{children:"Reference to the Credentials of the Trunk"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.uris"})}),(0,r.jsx)(n.td,{children:"The list of outbound URIs"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.uris[*].uri"})}),(0,r.jsx)(n.td,{children:"The outbound URI"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.uris[*].priority"})}),(0,r.jsx)(n.td,{children:"Reserved for future use"}),(0,r.jsx)(n.td,{children:"NA"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.uris[*].weight"})}),(0,r.jsx)(n.td,{children:"Reserved for future use"}),(0,r.jsx)(n.td,{children:"NA"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.uris[*].enabled"})}),(0,r.jsx)(n.td,{children:"Reserved for future use"}),(0,r.jsx)(n.td,{children:"NA"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.uris[*].transport"})}),(0,r.jsx)(n.td,{children:"The transport of the outbound URI"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.uris[*].user"})}),(0,r.jsx)(n.td,{children:"The user of the outbound URI"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.uris[*].host"})}),(0,r.jsx)(n.td,{children:"The host of the outbound URI"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.outbound.uris[*].port"})}),(0,r.jsx)(n.td,{children:"The port of the outbound URI"}),(0,r.jsx)(n.td,{children:"No"})]})]})]}),"\n",(0,r.jsx)(n.p,{children:"An example of a Trunks configuration file:"}),"\n",(0,r.jsxs)(n.p,{children:["Filename: ",(0,r.jsx)(n.code,{children:"trunks.yaml"})]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-yaml",children:"- apiVersion: v2beta1\n  kind: Trunk\n  ref: trunk-01\n  metadata:\n    name: Test Trunk\n    region: us-east1\n  spec:\n    inbound:\n      uri: trunk01.acme.com\n      accessControlListRef: acl-01\n    outbound:\n      sendRegister: true\n      credentialsRef: credentials-04\n      uris:\n        - uri:\n            user: pbx-1\n            host: sip.provider.net\n            port: 7060\n            transport: udp\n          enabled: true\n"})}),"\n",(0,r.jsxs)(n.p,{children:["In the ",(0,r.jsx)(n.code,{children:"spec.inbound"})," section, the ",(0,r.jsx)(n.code,{children:"uri"})," property helps Routr to identify the Trunk. Calls from the PSTN using the ",(0,r.jsx)(n.code,{children:"uri"})," will be routed to the Trunk. The ",(0,r.jsx)(n.code,{children:"accessControlListRef"})," property restricts the access to the Trunk. The ",(0,r.jsx)(n.code,{children:"accessControlListRef"})," is optional."]}),"\n",(0,r.jsxs)(n.p,{children:["In the ",(0,r.jsx)(n.code,{children:"spec.outbound"})," section, the ",(0,r.jsx)(n.code,{children:"sendRegister"})," property enables registration outbound registrations while the ",(0,r.jsx)(n.code,{children:"credentialsRef"})," property for authentication with your trunk provider."]}),"\n",(0,r.jsx)(n.p,{children:"In Routr, a Peer is a SIP entity that belongs to the same network as Routr. For example, Asterisk, FreeSWITCH, etc. The Peers configuration file has the following structure:"}),"\n",(0,r.jsxs)(n.table,{children:[(0,r.jsx)(n.thead,{children:(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.th,{children:"Property"}),(0,r.jsx)(n.th,{children:"Description"}),(0,r.jsx)(n.th,{children:"Required"})]})}),(0,r.jsxs)(n.tbody,{children:[(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"apiVersion"})}),(0,r.jsx)(n.td,{children:"The API version of the Peer"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"kind"})}),(0,r.jsx)(n.td,{children:"The kind of resource"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"ref"})}),(0,r.jsx)(n.td,{children:"Reference to the Peer"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.name"})}),(0,r.jsx)(n.td,{children:"A friendly name for the Peer"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.aor"})}),(0,r.jsx)(n.td,{children:"The Address of Record (AOR) of the Peer"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.username"})}),(0,r.jsx)(n.td,{children:"The username of the Peer"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.credentialsRef"})}),(0,r.jsx)(n.td,{children:"Reference to the Credentials of the Peer"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.loadBalancing.withSessionAffinity"})}),(0,r.jsx)(n.td,{children:"Enables session affinity"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.loadBalancing.algorithm"})}),(0,r.jsx)(n.td,{children:"The load balancing algorithm"}),(0,r.jsx)(n.td,{children:"No"})]})]})]}),"\n",(0,r.jsxs)(n.p,{children:["The ",(0,r.jsx)(n.code,{children:"spec.loadBalancing.withSessionAffinity"})," property enables session affinity, and the ",(0,r.jsx)(n.code,{children:"spec.loadBalancing.algorithm"})," property sets the load-balancing algorithm. The available algorithms are ",(0,r.jsx)(n.code,{children:"least-sessions"})," and ",(0,r.jsx)(n.code,{children:"round-robin"}),"."]}),"\n",(0,r.jsxs)(n.p,{children:["Remember that for the ",(0,r.jsx)(n.code,{children:"least-sessions"})," algorithm to work, your SIP backend includes the special header ",(0,r.jsx)(n.code,{children:"X-Session-Count"})," with the number of active sessions as part of the registration request."]}),"\n",(0,r.jsxs)(n.blockquote,{children:["\n",(0,r.jsx)(n.p,{children:"We are evaluating more flexible options to provide the session count, but as of now, you also need to make sure that registration requests happen frequently enough to keep the session count up to date."}),"\n"]}),"\n",(0,r.jsx)(n.p,{children:"An example of a Peers configuration file:"}),"\n",(0,r.jsxs)(n.p,{children:["Filename: ",(0,r.jsx)(n.code,{children:"peers.yaml"})]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-yaml",children:"- apiVersion: v2beta1\n  kind: Peer\n  ref: peer-01\n  metadata:\n    name: Asterisk (Media Server)\n  spec:\n    aor: sip:conference@sip.local\n    username: asterisk\n    credentialsRef: credentials-03\n    loadBalancing:\n     withSessionAffinity: true\n     algorithm: least-sessions\n"})}),"\n",(0,r.jsx)(n.p,{children:"Credentials in Routr help Agents and Peers authenticate with Routr."}),"\n",(0,r.jsx)(n.p,{children:"The Credentials configuration file has the following structure:"}),"\n",(0,r.jsxs)(n.table,{children:[(0,r.jsx)(n.thead,{children:(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.th,{children:"Property"}),(0,r.jsx)(n.th,{children:"Description"}),(0,r.jsx)(n.th,{children:"Required"})]})}),(0,r.jsxs)(n.tbody,{children:[(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"apiVersion"})}),(0,r.jsx)(n.td,{children:"The API version of the Credentials"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"kind"})}),(0,r.jsx)(n.td,{children:"The kind of resource"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"ref"})}),(0,r.jsx)(n.td,{children:"Reference to the Credentials"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.name"})}),(0,r.jsx)(n.td,{children:"A friendly name for the Credentials"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.credentials.username"})}),(0,r.jsx)(n.td,{children:"The username of the Credentials"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.credentials.password"})}),(0,r.jsx)(n.td,{children:"The password of the Credentials"}),(0,r.jsx)(n.td,{children:"Yes"})]})]})]}),"\n",(0,r.jsx)(n.p,{children:"An example of a Credentials configuration file:"}),"\n",(0,r.jsxs)(n.p,{children:["Filename: ",(0,r.jsx)(n.code,{children:"credentials.yaml"})]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-yaml",children:'- apiVersion: v2beta1\n  kind: Credentials\n  ref: credentials-01\n  metadata:\n    name: Agent Credentials\n  spec:\n    credentials:\n      username: "1001"\n      password: "1234"\n'})}),"\n",(0,r.jsx)(n.p,{children:"Routr also supports ACLs. ACLs are used to restrict access to Trunks and Domains."}),"\n",(0,r.jsx)(n.p,{children:"The ACLs configuration file has the following structure:"}),"\n",(0,r.jsxs)(n.table,{children:[(0,r.jsx)(n.thead,{children:(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.th,{children:"Property"}),(0,r.jsx)(n.th,{children:"Description"}),(0,r.jsx)(n.th,{children:"Required"})]})}),(0,r.jsxs)(n.tbody,{children:[(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"apiVersion"})}),(0,r.jsx)(n.td,{children:"The API version of the ACL"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"kind"})}),(0,r.jsx)(n.td,{children:"The kind of resource"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"ref"})}),(0,r.jsx)(n.td,{children:"Reference to the ACL"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"metadata.name"})}),(0,r.jsx)(n.td,{children:"A friendly name for the ACL"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.accessControlList.deny"})}),(0,r.jsx)(n.td,{children:"The list of deny rules"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.accessControlList.deny[*]"})}),(0,r.jsx)(n.td,{children:"The deny rule"}),(0,r.jsx)(n.td,{children:"Yes"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.accessControlList.allow"})}),(0,r.jsx)(n.td,{children:"The list of allow rules"}),(0,r.jsx)(n.td,{children:"No"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:(0,r.jsx)(n.code,{children:"spec.accessControlList.allow[*]"})}),(0,r.jsx)(n.td,{children:"The allow rule"}),(0,r.jsx)(n.td,{children:"Yes"})]})]})]}),"\n",(0,r.jsx)(n.p,{children:"An example of an ACLs configuration file:"}),"\n",(0,r.jsxs)(n.p,{children:["Filename: ",(0,r.jsx)(n.code,{children:"acl.yaml"})]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-yaml",children:"- apiVersion: v2beta1\n  kind: AccessControlList\n  ref: acl-01\n  metadata:\n    name: Europe ACL\n  spec:\n    accessControlList:\n      deny:\n        - 0.0.0.0/1\n      allow:\n        - 192.168.1.3/31\n        - 127.0.0.1/8\n        - 10.111.221.22/31\n"})}),"\n",(0,r.jsx)(n.h2,{id:"communication-and-protobuf-spec",children:"Communication and Protobuf Spec"}),"\n",(0,r.jsx)(n.p,{children:"Components communicate with the APIServer using gRPC. That includes SDKs, Command-line tools, Processors, Middleware, etc."}),"\n",(0,r.jsx)(n.p,{children:"The following protobuf defines the Agent service interface:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-protobuf",children:'syntax = "proto3";\n\npackage fonoster.routr.connect.agents.v2beta1;\n\n// The Agents service definition\nservice Agents {\n  // Creates a new Agent\n  rpc Create (CreateAgentRequest) returns (Agent) {}\n  // Updates an existing Agent\n  rpc Update (UpdateAgentRequest) returns (Agent) {}\n  // Gets an existing Agent\n  rpc Get (GetAgentRequest) returns (Agent) {}\n  // Deletes an existing Agent\n  rpc Delete (DeleteAgentRequest) returns (.google.protobuf.Empty) {}\n  // Lists all Agents\n  rpc List (ListAgentsRequest) returns (ListAgentsResponse) {}\n  // Find Agents by field name and value\n  rpc FindBy (FindByRequest) returns (FindByResponse) {}\n}\n\nenum Privacy {\n  PRIVATE = 0;\n  NONE = 1;\n}\n\n// The message for the Agent resource\nmessage Agent {\n  // The API version of the Agent\n  string api_version = 1;\n  // The unique identifier of the Agent\n  string ref = 2;\n  // The name of the Agent\n  string name = 3;\n  // The username of the Agent\n  string username = 4;\n  // The password of the Agent\n  Privacy privacy = 5;\n  // The enabled status of the Agent\n  bool enabled = 6;\n  // The created_at timestamp of the Agent\n  int32 created_at = 7;\n  // The updated_at timestamp of the Agent\n  int32 updated_at = 8;\n  // The domain of the Agent\n  fonoster.routr.connect.domains.v2beta1.Domain domain = 9;\n  // The credentials of the Agent\n  fonoster.routr.connect.credentials.v2beta1.Credentials credentials = 10;\n  // The extended attributes of the Agent\n  .google.protobuf.Struct extended = 11;  \n}\n\n// The request message for the Agents.Create method\nmessage CreateAgentRequest {\n  // The name of the Agent\n  string name = 1;\n  // The username of the Agent\n  string username = 2;\n  // The password of the Agent\n  Privacy privacy = 3;\n  // The enabled status of the Agent\n  bool enabled = 4;\n  // Reference to the Domain of the Agent\n  string domain_ref = 5;\n  // Reference to the Credentials of the Agent\n  string credentials_ref = 6;\n  // The extended attributes of the Agent\n  .google.protobuf.Struct extended = 7;  \n}\n\n// The request message for the Agents.Update method\nmessage UpdateAgentRequest {\n  // The unique identifier of the Agent\n  string ref = 1;\n  // The name of the Agent\n  string name = 2;\n  // The privacy settings of the Agent\n  Privacy privacy = 3;\n  // The enabled status of the Agent\n  bool enabled = 4;\n  // Reference to the Domain of the Agent\n  string domain_ref = 5;\n  // Reference to the Credentials of the Agent\n  string credentials_ref = 6;\n  // The extended attributes of the Agent\n  .google.protobuf.Struct extended = 7;\n}\n\n// The request message for the Agents.Get method\nmessage GetAgentRequest {\n  // The unique identifier of the Agent\n  string ref = 1;\n}\n\n// The request message for the Agents.Delete method\nmessage DeleteAgentRequest  {\n  // The unique identifier of the Agent\n  string ref = 1;\n}\n\n// The request message for the Agents.FindBy method\nmessage FindByRequest {\n  // The field name to search\n  string field_name = 1;\n  // The value to search\n  string field_value = 2;\n}\n\n// The response message for the Agents.FindBy method\nmessage FindByResponse {\n  // The list of Agents\n  repeated Agent items = 1;\n} \n\n// The request message for the Agents.List method\nmessage ListAgentsRequest {\n  // The maximum number of items in the list\n  int32 page_size = 1;\n\n  // The next_page_token value returned from the previous request, if any\n  string page_token = 2;\n}\n\n// The response message for the Agents.List method\nmessage ListAgentsResponse {\n  // List of Agents\n  repeated Agent items = 1;\n\n  // Token to retrieve the next page of results or empty if there are no more results in the list\n  string next_page_token = 2;\n}\n'})}),"\n",(0,r.jsxs)(n.p,{children:["To see the complete protobuf spec, please visit the ",(0,r.jsx)(n.a,{href:"https://github.com/fonoster/routr/tree/main/mods/common/src/connect/protos",children:"protobuf directory."})]}),"\n",(0,r.jsx)(n.h2,{id:"launching-the-apiserver",children:"Launching the APIServer"}),"\n",(0,r.jsxs)(n.p,{children:["Both implementations are available as Docker images from Docker Hub as ",(0,r.jsx)(n.code,{children:"fonoster/routr-pgdata"})," and ",(0,r.jsx)(n.code,{children:"fonoster/routr-simpledata"}),"."]}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"pgdata"})}),"\n",(0,r.jsxs)(n.p,{children:["To launch the ",(0,r.jsx)(n.code,{children:"pgdata"})," implementation with Docker, you can use the following command:"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:'docker run -it \\\n  -e DATABASE_URL="postgresql://postgres:postgres@localhost:5432/routr" \\\n  -p 51907:51907 \\\n  -p 51908:51908 \\\n  fonoster/routr-pgdata\n'})}),"\n",(0,r.jsxs)(n.p,{children:["The port ",(0,r.jsx)(n.code,{children:"51907"})," is used for internal communication, and the port ",(0,r.jsx)(n.code,{children:"51908"})," is used for external communication. The CTL and SDK use the external port to manage the data."]}),"\n",(0,r.jsx)(n.p,{children:(0,r.jsx)(n.strong,{children:"simpledata"})}),"\n",(0,r.jsxs)(n.p,{children:["To launch the ",(0,r.jsx)(n.code,{children:"simpledata"})," implementation with Docker, you can use the following command:"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"docker run -it \\\n  -v /path/to/resources:/etc/routr/resources \\\n  -p 51907:51907 \\\n  fonoster/routr-simpledata\n"})}),"\n",(0,r.jsx)(n.h2,{id:"quick-test-with-grpcurl",children:"Quick Test with gRPCurl"}),"\n",(0,r.jsxs)(n.p,{children:["One easy way to interact with the APIServer for testing and development is to use ",(0,r.jsx)(n.a,{href:"https://github.com/fullstorydev/grpcurl",children:"gRPCurl"}),". The following example shows how to send a request to the Agents service within the APIServer:"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-bash",children:"grpcurl -plaintext \\\n  -import-path /path/to/protos \\\n  -proto agents.proto  -d '{...}' \\\n  localhost:51907 \\\n  fonoster.routr.connect.agents.v2beta1.Agents/Get\n"})}),"\n",(0,r.jsxs)(n.p,{children:["Please remember that the ",(0,r.jsx)(n.code,{children:"simpledata"})," implementation does not accept write operations."]})]})}function a(e={}){const{wrapper:n}={...(0,d.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(h,{...e})}):h(e)}},8453:(e,n,s)=>{s.d(n,{R:()=>i,x:()=>c});var t=s(6540);const r={},d=t.createContext(r);function i(e){const n=t.useContext(d);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:i(e.components),t.createElement(d.Provider,{value:n},e.children)}}}]);