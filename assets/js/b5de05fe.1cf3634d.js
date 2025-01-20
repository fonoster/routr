"use strict";(self.webpackChunkroutr_docs=self.webpackChunkroutr_docs||[]).push([[803],{5934:(e,n,r)=>{r.r(n),r.d(n,{assets:()=>o,contentTitle:()=>a,default:()=>h,frontMatter:()=>l,metadata:()=>t,toc:()=>c});const t=JSON.parse('{"id":"administration/cli/cheatsheet","title":"Cheatsheet","description":"The rctl is a command-line interface for running commands against a Routr server. This overview covers rctl syntax, describes the command operations and provides common examples. For details about each command, including all the supported flags and subcommands, see the reference documentation below. This tool ships separately from the Routr server.","source":"@site/versioned_docs/version-1.x.x/administration/cli/cheatsheet.md","sourceDirName":"administration/cli","slug":"/administration/cli/cheatsheet","permalink":"/docs/1.x.x/administration/cli/cheatsheet","draft":false,"unlisted":false,"editUrl":"https://github.com/fonoster/routr/edit/main/docs/docs/versioned_docs/version-1.x.x/administration/cli/cheatsheet.md","tags":[],"version":"1.x.x","frontMatter":{},"sidebar":"tutorialSidebar","previous":{"title":"Concepts","permalink":"/docs/1.x.x/concepts"},"next":{"title":"Installation","permalink":"/docs/1.x.x/administration/cli/installation"}}');var s=r(4848),i=r(8453);const l={},a="Cheatsheet",o={},c=[{value:"Installation",id:"installation",level:2},{value:"Login to a Routr server",id:"login-to-a-routr-server",level:2},{value:"Syntax",id:"syntax",level:2},{value:"Examples: Common operations",id:"examples-common-operations",level:3},{value:"Cheat Sheet",id:"cheat-sheet",level:2},{value:"Request and store token",id:"request-and-store-token",level:3},{value:"Clear out the session credentials",id:"clear-out-the-session-credentials",level:3},{value:"Launch the Web Console",id:"launch-the-web-console",level:3},{value:"Showing the Registry",id:"showing-the-registry",level:3},{value:"Locating SIP Devices",id:"locating-sip-devices",level:3},{value:"Creating Resources",id:"creating-resources",level:3},{value:"Finding Resources",id:"finding-resources",level:3},{value:"Deleting Resources",id:"deleting-resources",level:3},{value:"Updating Resources",id:"updating-resources",level:3},{value:"Dump all available logs",id:"dump-all-available-logs",level:3},{value:"Restart the engine",id:"restart-the-engine",level:3},{value:"Stop the engine",id:"stop-the-engine",level:3},{value:"Check the engine status",id:"check-the-engine-status",level:3},{value:"Display version information",id:"display-version-information",level:3},{value:"Manage general configuration",id:"manage-general-configuration",level:3}];function d(e){const n={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",pre:"pre",ul:"ul",...(0,i.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.header,{children:(0,s.jsx)(n.h1,{id:"cheatsheet",children:"Cheatsheet"})}),"\n",(0,s.jsxs)(n.p,{children:["The ",(0,s.jsx)(n.code,{children:"rctl"})," is a command-line interface for running commands against a Routr server. This overview covers ",(0,s.jsx)(n.code,{children:"rctl"})," syntax, describes the command operations and provides common examples. For details about each command, including all the supported flags and subcommands, see the reference documentation below. This tool ships separately from the Routr server."]}),"\n",(0,s.jsx)(n.h2,{id:"installation",children:"Installation"}),"\n",(0,s.jsx)(n.p,{children:"To get the Routr Command-Line Tool run the following command:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-bash",children:"npm install -g routr-ctl\n"})}),"\n",(0,s.jsx)(n.p,{children:"The command-line tool is now globally accessible."}),"\n",(0,s.jsx)(n.h2,{id:"login-to-a-routr-server",children:"Login to a Routr server"}),"\n",(0,s.jsx)(n.p,{children:"To login to a Routr server, use the login command."}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-bash",children:"rctl login https://127.0.0.1:4567/api/{apiVersion} -u admin -p changeit\n"})}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsx)(n.p,{children:"The current API version is v1beta1"}),"\n"]}),"\n",(0,s.jsx)(n.h2,{id:"syntax",children:"Syntax"}),"\n",(0,s.jsxs)(n.p,{children:["Use the following syntax to run ",(0,s.jsx)(n.code,{children:"rctl"})," commands from your terminal window:"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"rctl COMMAND [REF] [flags]\n"})}),"\n",(0,s.jsxs)(n.p,{children:["where ",(0,s.jsx)(n.code,{children:"COMMAND"}),", ",(0,s.jsx)(n.code,{children:"subcommand"})," ",(0,s.jsx)(n.code,{children:"REF"}),", and ",(0,s.jsx)(n.code,{children:"flags"})," are:"]}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"COMMAND"}),": Specifies the operation that you want to perform on one or more resources. For example, create, get, delete, locate(loc)."]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"subcommand"}),": Specifies the resource type. Resource types are case-sensitive, and you can specify the singular, plural, or abbreviated forms. For example, the following commands produce the same output:"]}),"\n"]}),"\n"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"  $ rctl get gateway gweef506\n  $ rctl get gateways gweef506\n  $ rctl get gw gweef506\n"})}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"REF"}),": Specifies the reference to the resource. References are case-sensitive. For a full list, omit the reference. For example, ",(0,s.jsx)(n.code,{children:"$ rctl get agents"}),"."]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"flags"}),": Specifies optional flags. For example, you can use the --filter to further reduce the output of the ",(0,s.jsx)(n.code,{children:"get"})," command ."]}),"\n"]}),"\n"]}),"\n",(0,s.jsxs)(n.p,{children:["The --filter flag uses ",(0,s.jsx)(n.a,{href:"https://github.com/json-path/JsonPath",children:"JsonPath"})," to perform the filtering. The root is always '$'.\nAll you need to add is the path to the property and the filter operators. For example:"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# This returns all the Numbers in Gateway 'gweef506'\nrctl get numbers --filter \"@.metadata.gwRef=='gweef506'\"    \n"})}),"\n",(0,s.jsxs)(n.p,{children:["If you need help, just run ",(0,s.jsx)(n.code,{children:"rctl --help"})," from the terminal window."]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"$ rctl --help\nusage: rctl [-h] [-v] COMMAND ...\n\nA tool for the management of a Routr instance\n\nnamed arguments:\n  -h, --help             show this help message and exit\n  -v, --version          print version information and quit\n\nCommands:\n  COMMAND\n    get                  display a list of resources\n    create (crea)        creates new resource(s)\n    apply                apply changes over existing resource(s)\n    delete (del)         delete an existing resource(s)\n    locate (loc)         locate sip device(s)\n    registry (reg)       shows gateways registrations\n    proxy                run a proxy to the server (beta)\n    login                sets connection info\n    logout               clear session credentials\n    logs                 dumps all the available system logs\n    restart              restarts the engine\n    stop                 stops the engine\n    ping                 checks engine status\n    version (ver)        obtain rctl's version information\n    config               manage routr configuration\n\nRun 'rctl COMMAND --help' for more information on a command\n"})}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:["Important: Some commands (i.e.: create, delete) are not available in the default implementation of the ",(0,s.jsx)(n.code,{children:"resources"})," modules. Only persistent implementations support these commands."]}),"\n"]}),"\n",(0,s.jsx)(n.h3,{id:"examples-common-operations",children:"Examples: Common operations"}),"\n",(0,s.jsxs)(n.p,{children:["Use the following set of examples to help you familiarize yourself with running the commonly used ",(0,s.jsx)(n.code,{children:"rctl"})," operations:"]}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"rctl locate"})," or ",(0,s.jsx)(n.code,{children:"rctl loc"})," - Locate a sip device registered on the Routr server"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"// Locate all Sip Devices registered against a Routr server\n$ rctl loc\n"})}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"rctl registry"})," or ",(0,s.jsx)(n.code,{children:"rctl reg"})," - Shows Gateways current registration."]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"// Shows the registry\n$ rctl reg\n"})}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"rctl get"})," - List one or more resources."]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"// List all numbers\n$ rctl get numbers\n\n// List all numbers that belong to gateway reference gweef506\n$ rctl get numbers --filter \"@.metadata.ref=='gweef506'\"\n\n// List number by reference\n$ rctl get numbers dd50baa4\n\n// List all agents\n$ rctl get agents\n"})}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"rctl create"})," - create a new resource."]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"// Create a new gateway(s) using a .yaml or .yml file\n$ rctl create -f new-gateway.yaml\n"})}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"rctl apply"})," - update an existing resource(s)"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"// Update an existing resource(s) .yaml or .yml.\n$ rctl apply -f new-gateway.yaml\n"})}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.code,{children:"rctl delete"})," - delete a resource."]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"// Delete all numbers for gateway reference gweef506\n$ rctl delete numbers --filter \"@.metadata.gwRef=='gweef506'\"\n\n// Delete a single agent (using delete alias)\n$ rctl del agent ag3f77f6\n"})}),"\n",(0,s.jsx)(n.h2,{id:"cheat-sheet",children:"Cheat Sheet"}),"\n",(0,s.jsxs)(n.blockquote,{children:["\n",(0,s.jsxs)(n.p,{children:["Create, delete, and update are only available in some implementations of the ",(0,s.jsx)(n.code,{children:"resources"})," module."]}),"\n"]}),"\n",(0,s.jsx)(n.h3,{id:"request-and-store-token",children:"Request and store token"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# Request authentication for subsequent commands\n$ rctl login https://127.0.0.1:4567/api/{apiVersion} -u admin -p changeit\n"})}),"\n",(0,s.jsx)(n.h3,{id:"clear-out-the-session-credentials",children:"Clear out the session credentials"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# Clear session credentials\n$ rctl logout\n"})}),"\n",(0,s.jsx)(n.h3,{id:"launch-the-web-console",children:"Launch the Web Console"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# The Web Console re-uses the credentials of your Command-Line Tool\nrctl proxy\n"})}),"\n",(0,s.jsx)(n.h3,{id:"showing-the-registry",children:"Showing the Registry"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# Shows all the Gateways that are currently available\n$ rctl registry                                       # Shows only current registrations. You may use `reg` for short\n"})}),"\n",(0,s.jsx)(n.h3,{id:"locating-sip-devices",children:"Locating SIP Devices"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# Find all sip devices available at the location service\n$ rctl locate                                         # This list does not include number-ingress-routes or domain-egress-routes\n"})}),"\n",(0,s.jsx)(n.h3,{id:"creating-resources",children:"Creating Resources"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# Create new peers and agents\n$ rctl create -f asterisk.yaml                        # Create Peer in file asterisk.yaml\n$ rctl create -f agents-list.yaml                     # Create Agents in file agents-list.yaml\n"})}),"\n",(0,s.jsx)(n.h3,{id:"finding-resources",children:"Finding Resources"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# Get Numbers\n$ rctl get numbers                                          # List all available Numbers\n$ rctl get number                                          # List all available Numbers\n$ rctl get number --filter \"@.metadata.ref=='dd50baa4'\"     # Shows Number with reference 'Number0001'\n$ rctl get number --filter \"@.metadata.gwRef=='gweef506'\"   # Shows Numbers with Gateway reference 'GW1232'\n\n# Get agents\n$ rctl get agents                                        # List all Agents\n"})}),"\n",(0,s.jsx)(n.h3,{id:"deleting-resources",children:"Deleting Resources"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# Delete command by refernce or filter\n$ rctl delete agent ag3f77f6                             # Delete Agent by reference\n$ rctl del numbers --filter '@.metadata.gwRef=gweef506'     # Delete Numbers using a filter\n"})}),"\n",(0,s.jsx)(n.h3,{id:"updating-resources",children:"Updating Resources"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"$ rctl apply -f asterisk.yaml                         # Create Peer in file asterisk.yaml\n$ rctl apply -f agents-list.yaml                      # Create Agents in file agents-list.yaml\n"})}),"\n",(0,s.jsx)(n.h3,{id:"dump-all-available-logs",children:"Dump all available logs"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"$ rctl logs\n"})}),"\n",(0,s.jsx)(n.h3,{id:"restart-the-engine",children:"Restart the engine"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# To restart the engine immediately use the --now flag\n$ rctl restart --now\n"})}),"\n",(0,s.jsx)(n.h3,{id:"stop-the-engine",children:"Stop the engine"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# To stop the engine immediately use the --now flag\n$ rctl restart --now\n"})}),"\n",(0,s.jsx)(n.h3,{id:"check-the-engine-status",children:"Check the engine status"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"$ rctl ping\n"})}),"\n",(0,s.jsx)(n.h3,{id:"display-version-information",children:"Display version information"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"$ rctl ver\n"})}),"\n",(0,s.jsx)(n.h3,{id:"manage-general-configuration",children:"Manage general configuration"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"# To update configuration use the apply subommand\n$ rctl config apply -f /path/to/config.yml\n\n# To see the configuration use the describe subcommand\n$ rctl config describe --full\n"})})]})}function h(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(d,{...e})}):d(e)}},8453:(e,n,r)=>{r.d(n,{R:()=>l,x:()=>a});var t=r(6540);const s={},i=t.createContext(s);function l(e){const n=t.useContext(i);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:l(e.components),t.createElement(i.Provider,{value:n},e.children)}}}]);