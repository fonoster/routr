"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[9587],{3905:(e,t,n)=>{n.d(t,{Zo:()=>l,kt:()=>f});var r=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function p(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function u(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},o=Object.keys(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)n=o[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var i=r.createContext({}),s=function(e){var t=r.useContext(i),n=t;return e&&(n="function"==typeof e?e(t):p(p({},t),e)),n},l=function(e){var t=s(e.components);return r.createElement(i.Provider,{value:t},e.children)},c="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},d=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,o=e.originalType,i=e.parentName,l=u(e,["components","mdxType","originalType","parentName"]),c=s(n),d=a,f=c["".concat(i,".").concat(d)]||c[d]||m[d]||o;return n?r.createElement(f,p(p({ref:t},l),{},{components:n})):r.createElement(f,p({ref:t},l))}));function f(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=n.length,p=new Array(o);p[0]=d;var u={};for(var i in t)hasOwnProperty.call(t,i)&&(u[i]=t[i]);u.originalType=e,u[c]="string"==typeof e?e:a,p[1]=u;for(var s=2;s<o;s++)p[s]=n[s];return r.createElement.apply(null,p)}return r.createElement.apply(null,n)}d.displayName="MDXCreateElement"},4386:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>i,contentTitle:()=>p,default:()=>m,frontMatter:()=>o,metadata:()=>u,toc:()=>s});var r=n(7462),a=(n(7294),n(3905));const o={},p="updateNumber",u={unversionedId:"api/numbers/update",id:"version-1.x.x/api/numbers/update",title:"updateNumber",description:"Updates an existing Number.",source:"@site/versioned_docs/version-1.x.x/api/numbers/update.md",sourceDirName:"api/numbers",slug:"/api/numbers/update",permalink:"/docs/api/numbers/update",draft:!1,editUrl:"https://github.com/fonoster/routr/tree/main/packages/create-docusaurus/templates/shared/versioned_docs/version-1.x.x/api/numbers/update.md",tags:[],version:"1.x.x",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"listNumbers",permalink:"/docs/api/numbers/list"},next:{title:"createPeer",permalink:"/docs/api/peers/create"}},i={},s=[],l={toc:s},c="wrapper";function m(e){let{components:t,...n}=e;return(0,a.kt)(c,(0,r.Z)({},l,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"updatenumber"},"updateNumber"),(0,a.kt)("p",null,"Updates an existing Number."),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"URL")),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"/numbers/{ref}")),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"Method")),(0,a.kt)("p",null,(0,a.kt)("inlineCode",{parentName:"p"},"PUT")),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"Parameters")),(0,a.kt)("p",null,"This method does not receive any parameters."),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"Request body")),(0,a.kt)("p",null,"A file containing a ",(0,a.kt)("a",{parentName:"p",href:"/configuration/numbers"},"Number")," resource in ",(0,a.kt)("inlineCode",{parentName:"p"},"json")," format."),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"Response")),(0,a.kt)("p",null,"If successful this method updates a Number."),(0,a.kt)("p",null,(0,a.kt)("strong",{parentName:"p"},"Sample Call")),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-json"},'PUT /api/v1beta1/numbers/dd50baa4\n{\n  "apiVersion": "v1beta1",\n  "kind": "Number",\n  "metadata": {\n    "ref": "dd50baa4",\n    "gwRef": "gweef506",\n    "geoInfo": {\n      "city": "City, State",\n      "country": "Country",\n      "countryISOCode": "US"\n    }\n  },\n  "spec": {\n    "location": {\n      "telUrl": "tel:0000000000",\n      "aorLink": "sip:1001@sip.local"\n    }\n  }\n}\n\nHTTP/1.1 200 OK\n{\n  "status": "200",\n  "message": "Successful request"\n}\n')))}m.isMDXComponent=!0}}]);