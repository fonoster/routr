"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[8845],{3905:(e,t,n)=>{n.d(t,{Zo:()=>p,kt:()=>h});var r=n(7294);function i(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function a(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function o(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?a(Object(n),!0).forEach((function(t){i(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):a(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,r,i=function(e,t){if(null==e)return{};var n,r,i={},a=Object.keys(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||(i[n]=e[n]);return i}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(i[n]=e[n])}return i}var l=r.createContext({}),c=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):o(o({},t),e)),n},p=function(e){var t=c(e.components);return r.createElement(l.Provider,{value:t},e.children)},u="mdxType",g={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},d=r.forwardRef((function(e,t){var n=e.components,i=e.mdxType,a=e.originalType,l=e.parentName,p=s(e,["components","mdxType","originalType","parentName"]),u=c(n),d=i,h=u["".concat(l,".").concat(d)]||u[d]||g[d]||a;return n?r.createElement(h,o(o({ref:t},p),{},{components:n})):r.createElement(h,o({ref:t},p))}));function h(e,t){var n=arguments,i=t&&t.mdxType;if("string"==typeof e||i){var a=n.length,o=new Array(a);o[0]=d;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s[u]="string"==typeof e?e:i,o[1]=s;for(var c=2;c<a;c++)o[c]=n[c];return r.createElement.apply(null,o)}return r.createElement.apply(null,n)}d.displayName="MDXCreateElement"},5033:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>o,default:()=>g,frontMatter:()=>a,metadata:()=>s,toc:()=>c});var r=n(7462),i=(n(7294),n(3905));const a={},o="Securing the signaling path",s={unversionedId:"guides/securing-the-signaling-path",id:"version-1.x.x/guides/securing-the-signaling-path",title:"Securing the signaling path",description:"Follow this guide to secure the signaling between your endpoints and Routr. Keep in mind that Routr only secures the signaling and that the endpoints are ultimately responsible for securing the media.",source:"@site/versioned_docs/version-1.x.x/guides/securing-the-signaling-path.md",sourceDirName:"guides",slug:"/guides/securing-the-signaling-path",permalink:"/docs/1.x.x/guides/securing-the-signaling-path",draft:!1,editUrl:"https://github.com/fonoster/routr-website/edit/main/versioned_docs/version-1.x.x/guides/securing-the-signaling-path.md",tags:[],version:"1.x.x",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"Running with Docker",permalink:"/docs/1.x.x/guides/running-with-docker-or-compose"},next:{title:"overview",permalink:"/docs/1.x.x/api/overview"}},l={},c=[{value:"Creating a Java Keystore(.JKS) certificate",id:"creating-a-java-keystorejks-certificate",level:2},{value:"Creating a self-signed Certificate",id:"creating-a-self-signed-certificate",level:3},{value:"Creating a Certificate using Let&#39;s Encrypt",id:"creating-a-certificate-using-lets-encrypt",level:3},{value:"Installing the Certificate in Routr",id:"installing-the-certificate-in-routr",level:2},{value:"Setting up the Sip Phones",id:"setting-up-the-sip-phones",level:2}],p={toc:c},u="wrapper";function g(e){let{components:t,...n}=e;return(0,i.kt)(u,(0,r.Z)({},p,n,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("h1",{id:"securing-the-signaling-path"},"Securing the signaling path"),(0,i.kt)("p",null,"Follow this guide to secure the signaling between your endpoints and Routr. Keep in mind that ",(0,i.kt)("em",{parentName:"p"},"Routr")," only secures the signaling and that the endpoints are ultimately responsible for securing the media."),(0,i.kt)("blockquote",null,(0,i.kt)("p",{parentName:"blockquote"},"For this guide, we used a fictitious domain name to demonstrate the process of securing the signaling path")),(0,i.kt)("img",{src:"/img/secure_signaling.png",width:"600",vspace:"30"}),(0,i.kt)("h2",{id:"creating-a-java-keystorejks-certificate"},"Creating a Java Keystore(.JKS) certificate"),(0,i.kt)("p",null,"We need a keystore (.jks) to properly handling the certificates. The following steps create a valid keystore file using a self-signed method or using the free ",(0,i.kt)("a",{parentName:"p",href:"https://letsencrypt.org/"},"Let's Encrypt service"),"."),(0,i.kt)("h3",{id:"creating-a-self-signed-certificate"},"Creating a self-signed Certificate"),(0,i.kt)("p",null,"Perhaps the easiest way to create a valid certificate for Routr is using a self-signed certificate. To generate the certificate change into ",(0,i.kt)("inlineCode",{parentName:"p"},"etc/certs")," in your Routr installation and run the following script:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-bash"},'keytool -genkey -keyalg RSA \\\n -noprompt \\\n -alias routr \\\n -keystore domains-cert.jks \\\n -storepass changeit \\\n -keypass changeit \\\n -validity 365 \\\n -keysize 2048 \\\n -dname "CN=sip.ocean.com, OU=OSS, O=Your Company Inc, L=Sanford, ST=NC, C=US" \\\n -ext SAN=dns:sip.ocean.com,dns:localhost,ip:127.0.0.1\n')),(0,i.kt)("p",null,"Remember to adjust the values to match your project's information."),(0,i.kt)("blockquote",null,(0,i.kt)("p",{parentName:"blockquote"},(0,i.kt)("inlineCode",{parentName:"p"},"WSS")," does not work with a self-signed certificate. However, you can add a security exception by using ",(0,i.kt)("inlineCode",{parentName:"p"},"https")," instead of ",(0,i.kt)("inlineCode",{parentName:"p"},"wss")," in your browser's search bar and then accepting the security certificate.")),(0,i.kt)("h3",{id:"creating-a-certificate-using-lets-encrypt"},"Creating a Certificate using Let's Encrypt"),(0,i.kt)("p",null,"The recommended way to create a valid certificate for Routr is using the free service ",(0,i.kt)("a",{parentName:"p",href:"https://letsencrypt.org"},"Let's Encrypt"),". Please go to ",(0,i.kt)("a",{parentName:"p",href:"https://letsencrypt.org/"},"https://letsencrypt.org/")," for details on how to install the required tooling. To generate the certificate, use the following steps:"),(0,i.kt)("p",null,"\u278a"," Create keys"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-bash"},"certbot certonly --standalone -d sip.ocean.com --email admin@sip.ocean.com\n")),(0,i.kt)("p",null,"Change to the directory where we created the certificates(generally at /etc/letsencrypt/live/sip.ocean.com)."),(0,i.kt)("p",null,"\u278b"," Create a PKCS12 file containing full chain and private key"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-bash"},"openssl pkcs12 -export -in fullchain.pem -inkey privkey.pem -out pkcs.p12 -name domains-cert.jks\n")),(0,i.kt)("p",null,"Please make a note of the password since you need it in the next step."),(0,i.kt)("p",null,"\u278c"," Convert PKCS12 to Keystore"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-bash"},"keytool -importkeystore -srckeystore keystore.pkcs12 -srcstoretype PKCS12 -destkeystore domains-cert.jks\n")),(0,i.kt)("h2",{id:"installing-the-certificate-in-routr"},"Installing the Certificate in Routr"),(0,i.kt)("p",null,"To enable secure signaling in Routr, copy your certificate in ",(0,i.kt)("inlineCode",{parentName:"p"},"etc/certs")," and edit the file ",(0,i.kt)("inlineCode",{parentName:"p"},"config/config.yml")," to look like this:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-yml"},"apiVersion: v1beta1\nmetadata:\n  userAgent: Routr v1.0\nspec:\n  securityContext:\n    keyStore: etc/certs/domains-cert.jks\n    trustStore: etc/certs/domains-cert.jks\n    keyStorePassword: 'changeit'\n    trustStorePassword: 'changeit'\n    keyStoreType: 'jks'\n    debugging: true                  # Enabled debug only for testing\n  transport:\n    - protocol: tls\n      port: 5061\n...\n")),(0,i.kt)("p",null,"If you set the property ",(0,i.kt)("inlineCode",{parentName:"p"},"spec.securityContext.debugging"),"  to ",(0,i.kt)("inlineCode",{parentName:"p"},"true"),", you can get some valuable information about the status of the configuration. You can also test your configuration using the following command:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre"},"openssl s_client -host 192.168.1.2 -port 5061    # Remember to use Routr's IP\n")),(0,i.kt)("h2",{id:"setting-up-the-sip-phones"},"Setting up the Sip Phones"),(0,i.kt)("blockquote",null,(0,i.kt)("p",{parentName:"blockquote"},"For this guide, we are using ",(0,i.kt)("inlineCode",{parentName:"p"},"Blink Pro"),".")),(0,i.kt)("p",null,"Go to the account that you want to secure, select ",(0,i.kt)("inlineCode",{parentName:"p"},"Advanced -> Sip Signaling")," and change the parameter ",(0,i.kt)("inlineCode",{parentName:"p"},"Primary Proxy")," to ",(0,i.kt)("inlineCode",{parentName:"p"},"${proxyHost}:${proxyPort};transport=tls"),". See the example in the following image:"),(0,i.kt)("img",{src:"/img/blinkpro_tls_config.png",width:"600"}),(0,i.kt)("p",null,"If everything went well, you should see a green padlock like the one in the image below:"),(0,i.kt)("img",{src:"/img/blinkpro_tls_secured.png",width:"400"}))}g.isMDXComponent=!0}}]);