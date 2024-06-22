# CTL

Command-Line for Routr server.

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @routr/ctl
$ rctl COMMAND
running command...
$ rctl (--version)
@routr/ctl/2.1.11 linux-x64 node-v18.17.1
$ rctl --help [COMMAND]
USAGE
  $ rctl COMMAND
...
```

# Commands

## `rctl acl create`

Creates a new ACL

```
USAGE
  $ rctl acl create [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Creates a new ACL

EXAMPLES
  $ rctl acl create
  Creating ACL US Eeast... b148b4b4-6884-4c06-bb7e-bd098f5fe793
```

_See code: [dist/commands/acl/create.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/acl/create.ts)_

## `rctl acl delete [REF]`

Deletes an Access Control List

```
USAGE
  $ rctl acl delete [REF] [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Deletes an Access Control List

EXAMPLES
  $ rctl acl delete
  Deleting item 80181ca6-d4aa-4575-9375-8f72b071111... Done
```

_See code: [dist/commands/acl/delete.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/acl/delete.ts)_

## `rctl acl describe [REF]`

shows details of an ACL

```
USAGE
  $ rctl acl describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to the ACL

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details of an ACL
```

_See code: [dist/commands/acl/describe.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/acl/describe.ts)_

## `rctl acl get [REF]`

Shows a list of paginated ACLs or a single ACL if a ref is provided

```
USAGE
  $ rctl acl get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  REF  optional reference to an ACL

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server
  -s, --size=<value>      [default: 50] the number of items to return
  -x, --extended          extended output format

DESCRIPTION
  Shows a list of paginated ACLs or a single ACL if a ref is provided

EXAMPLES
  $ rctl acl get
  Ref                                  Name              Deny List Allow List
  9e7a88f0-8390-42f5-a2cb-689583ba9f4f Local Network ACL 0.0.0.0/0 10.0.0.28
```

_See code: [dist/commands/acl/get.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/acl/get.ts)_

## `rctl acl update REF`

Updates an existing ACL

```
USAGE
  $ rctl acl update [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to an ACL

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Updates an existing ACL

EXAMPLES
  $ rctl acl update
  Updating ACL US East... 80181ca6-d4aa-4575-9375-8f72b07d5555
```

_See code: [dist/commands/acl/update.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/acl/update.ts)_

## `rctl agents create`

Creates a new Agent

```
USAGE
  $ rctl agents create [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Creates a new Agent

EXAMPLES
  $ rctl agents create
  Creating Agent Jhon Doe... b148b4b4-6884-4c06-bb7e-bd098f5fe793
```

_See code: [dist/commands/agents/create.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/agents/create.ts)_

## `rctl agents delete [REF]`

Deletes an Agent

```
USAGE
  $ rctl agents delete [REF] [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Deletes an Agent

EXAMPLES
  $ rctl agents delete
  Deleting item 80181ca6-d4aa-4575-9375-8f72b071111... Done
```

_See code: [dist/commands/agents/delete.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/agents/delete.ts)_

## `rctl agents describe [REF]`

shows details of an Agent

```
USAGE
  $ rctl agents describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to the Agent

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details of an Agent
```

_See code: [dist/commands/agents/describe.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/agents/describe.ts)_

## `rctl agents get [REF]`

Shows a list of paginated Agents or a single Agent if ref is provided

```
USAGE
  $ rctl agents get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  REF  Optional Agents reference

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server
  -s, --size=<value>      [default: 50] The number of items to return
  -x, --extended          extended output format

DESCRIPTION
  Shows a list of paginated Agents or a single Agent if ref is provided

EXAMPLES
  $ rctl agents get
  Ref                                  Name     Username Domain    Privacy Enabled
  d31f5fb8-e367-42f7-9884-1a7999f53fe8 John Doe jdoe     sip.local PRIVATE Yes
```

_See code: [dist/commands/agents/get.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/agents/get.ts)_

## `rctl agents update REF`

Updates an existing Agent

```
USAGE
  $ rctl agents update [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to an existing Agent

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Updates an existing Agent

EXAMPLES
  $ rctl agents update
  Updating Agent John Doe... 80181ca6-d4aa-4575-9375-8f72b07d5555
```

_See code: [dist/commands/agents/update.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/agents/update.ts)_

## `rctl autocomplete [SHELL]`

display autocomplete installation instructions

```
USAGE
  $ rctl autocomplete [SHELL] [-r]

ARGUMENTS
  SHELL  shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  display autocomplete installation instructions

EXAMPLES
  $ rctl autocomplete

  $ rctl autocomplete bash

  $ rctl autocomplete zsh

  $ rctl autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v1.4.6/src/commands/autocomplete/index.ts)_

## `rctl credentials create`

Creates a new set of Credentials

```
USAGE
  $ rctl credentials create [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Creates a new set of Credentials

EXAMPLES
  $ rctl credentials create
  Creating Credentials JDoe Access... b148b4b4-6884-4c06-bb7e-bd098f5fe793
```

_See code: [dist/commands/credentials/create.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/credentials/create.ts)_

## `rctl credentials delete [REF]`

Deletes a set of Credentials

```
USAGE
  $ rctl credentials delete [REF] [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Deletes a set of Credentials

EXAMPLES
  $ rctl credentials delete
  Deleting item 80181ca6-d4aa-4575-9375-8f72b071111... Done
```

_See code: [dist/commands/credentials/delete.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/credentials/delete.ts)_

## `rctl credentials describe [REF]`

shows details for a set of Credentials

```
USAGE
  $ rctl credentials describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to the set of Credentials

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details for a set of Credentials
```

_See code: [dist/commands/credentials/describe.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/credentials/describe.ts)_

## `rctl credentials get [REF]`

Shows a list of paginated Credentials or a single set if ref is provided

```
USAGE
  $ rctl credentials get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  REF  optional reference to a set of Credentials

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server
  -s, --size=<value>      [default: 50] the number of items to return
  -x, --extended          extended output format

DESCRIPTION
  Shows a list of paginated Credentials or a single set if ref is provided

EXAMPLES
  $ rctl credentials get
  Ref                                  Name       Deny List Allow List
  80181ca6-d4aa-4575-9375-8f72b07d6666 Europe ACL 0.0.0.0/0 10.0.0.25
```

_See code: [dist/commands/credentials/get.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/credentials/get.ts)_

## `rctl credentials update REF`

Updates an existing set of Credentials

```
USAGE
  $ rctl credentials update [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to an existing set of Credentials

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Updates an existing set of Credentials

EXAMPLES
  $ rctl credentials update
  Updating Credentials JDoe Credentials... 80181ca6-d4aa-4575-9375-8f72b07d5555
```

_See code: [dist/commands/credentials/update.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/credentials/update.ts)_

## `rctl domains create`

Creates a new set Domain

```
USAGE
  $ rctl domains create [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Creates a new set Domain

EXAMPLES
  $ rctl domains create
  Creating Domain Local Domain... b148b4b4-6884-4c06-bb7e-bd098f5fe793
```

_See code: [dist/commands/domains/create.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/domains/create.ts)_

## `rctl domains delete [REF]`

Deletes a Domain

```
USAGE
  $ rctl domains delete [REF] [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Deletes a Domain

EXAMPLES
  $ rctl domains delete
  Deleting item 80181ca6-d4aa-4575-9375-8f72b071111... Done
```

_See code: [dist/commands/domains/delete.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/domains/delete.ts)_

## `rctl domains describe [REF]`

show details of a Domain

```
USAGE
  $ rctl domains describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to the Domain

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  show details of a Domain
```

_See code: [dist/commands/domains/describe.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/domains/describe.ts)_

## `rctl domains get [REF]`

Shows a list of paginated Domains or a single Domain if ref is provided

```
USAGE
  $ rctl domains get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  REF  optional reference to a Domain

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server
  -s, --size=<value>      [default: 50] the number of items to return
  -x, --extended          extended output format

DESCRIPTION
  Shows a list of paginated Domains or a single Domain if ref is provided

EXAMPLES
  $ rctl domains get
  Ref                                  Name         URI            
  ab2b6959-f497-4b14-903b-85a7c464b564 Local Domain sip.local
```

_See code: [dist/commands/domains/get.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/domains/get.ts)_

## `rctl domains update REF`

Updates an existing Domain

```
USAGE
  $ rctl domains update [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to an existing Domain

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Updates an existing Domain

EXAMPLES
  $ rctl domains update
  Updating Domain Local... 80181ca6-d4aa-4575-9375-8f72b07d5555
```

_See code: [dist/commands/domains/update.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/domains/update.ts)_

## `rctl numbers create`

Creates a new Number

```
USAGE
  $ rctl numbers create [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Creates a new Number

EXAMPLES
  $ rctl numbers create
  Creating Number (784) 317-8170... a134487f-a668-4509-9ddd-dcbc98175468
```

_See code: [dist/commands/numbers/create.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/numbers/create.ts)_

## `rctl numbers delete [REF]`

Deletes a Number

```
USAGE
  $ rctl numbers delete [REF] [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Deletes a Number

EXAMPLES
  $ rctl numbers delete
  Deleting item 80181ca6-d4aa-4575-9375-8f72b071111... Done
```

_See code: [dist/commands/numbers/delete.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/numbers/delete.ts)_

## `rctl numbers describe [REF]`

shows details for a Number

```
USAGE
  $ rctl numbers describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to the Number

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details for a Number
```

_See code: [dist/commands/numbers/describe.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/numbers/describe.ts)_

## `rctl numbers get [REF]`

Shows a list of paginated Numbers or a single Number if ref is provided

```
USAGE
  $ rctl numbers get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  REF  optional reference to a Number

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server
  -s, --size=<value>      [default: 50] the number of items to return
  -x, --extended          extended output format

DESCRIPTION
  Shows a list of paginated Numbers or a single Number if ref is provided

EXAMPLES
  $ rctl numbers get
  Ref                                  Name           Telephony URL      AOR Link           Geo              
  a134487f-a668-4509-9ddd-dcbc98175468 (785) 317-8070 +17853178070       sip:1001@sip.local Cameron, USA (US)
```

_See code: [dist/commands/numbers/get.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/numbers/get.ts)_

## `rctl numbers update REF`

Updates an existing set of Credentials

```
USAGE
  $ rctl numbers update [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to an existing Number

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Updates an existing set of Credentials

EXAMPLES
  $ rctl numbers update
  Updating Number (785) 317-8070... 80181ca6-d4aa-4575-9375-8f72b07d5555
```

_See code: [dist/commands/numbers/update.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/numbers/update.ts)_

## `rctl peers create`

Creates a new Peer

```
USAGE
  $ rctl peers create [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Creates a new Peer

EXAMPLES
  $ rctl peers create
  Creating Peer Asterisk Conference... b148b4b4-6884-4c06-bb7e-bd098f5fe793
```

_See code: [dist/commands/peers/create.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/peers/create.ts)_

## `rctl peers delete [REF]`

Deletes a Peer

```
USAGE
  $ rctl peers delete [REF] [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Deletes a Peer

EXAMPLES
  $ rctl peers delete
  Deleting item 80181ca6-d4aa-4575-9375-8f72b071111... Done
```

_See code: [dist/commands/peers/delete.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/peers/delete.ts)_

## `rctl peers describe [REF]`

shows details for a Peer

```
USAGE
  $ rctl peers describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to the Peer

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details for a Peer
```

_See code: [dist/commands/peers/describe.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/peers/describe.ts)_

## `rctl peers get [REF]`

Shows a list of paginated Peers or a single Peer if ref is provided

```
USAGE
  $ rctl peers get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  REF  optional reference to a Peer

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server
  -s, --size=<value>      [default: 50] the number of items to return
  -x, --extended          extended output format

DESCRIPTION
  Shows a list of paginated Peers or a single Peer if ref is provided

EXAMPLES
  $ rctl peers get
  Ref                                  Name                Username   AOR                      Balancing Algorithm Session Affinity 
  6f941c63-880c-419a-a72a-4a107cbaf5c5 Asterisk Conference conference sip:conference@sip.local ROUND_ROBIN         Yes
```

_See code: [dist/commands/peers/get.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/peers/get.ts)_

## `rctl peers update REF`

Updates an existing Peer

```
USAGE
  $ rctl peers update [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to an existing Peer

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Updates an existing Peer

EXAMPLES
  $ rctl peers update
  Updating Peer Asterisk Conf... 80181ca6-d4aa-4575-9375-8f72b07d5555
```

_See code: [dist/commands/peers/update.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/peers/update.ts)_

## `rctl plugins`

List installed plugins.

```
USAGE
  $ rctl plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ rctl plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/index.ts)_

## `rctl plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ rctl plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ rctl plugins add

EXAMPLES
  $ rctl plugins:install myplugin 

  $ rctl plugins:install https://github.com/someuser/someplugin

  $ rctl plugins:install someuser/someplugin
```

## `rctl plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ rctl plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ rctl plugins:inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/inspect.ts)_

## `rctl plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ rctl plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ rctl plugins add

EXAMPLES
  $ rctl plugins:install myplugin 

  $ rctl plugins:install https://github.com/someuser/someplugin

  $ rctl plugins:install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/install.ts)_

## `rctl plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ rctl plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ rctl plugins:link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/link.ts)_

## `rctl plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ rctl plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ rctl plugins unlink
  $ rctl plugins remove
```

## `rctl plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ rctl plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ rctl plugins unlink
  $ rctl plugins remove
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/uninstall.ts)_

## `rctl plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ rctl plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ rctl plugins unlink
  $ rctl plugins remove
```

## `rctl plugins update`

Update installed plugins.

```
USAGE
  $ rctl plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.4.7/src/commands/plugins/update.ts)_

## `rctl trunks create`

Creates a new Trunk

```
USAGE
  $ rctl trunks create [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Creates a new Trunk

EXAMPLES
  $ rctl trunks create
  Creating Trunk T01... b148b4b4-6884-4c06-bb7e-bd098f5fe793
```

_See code: [dist/commands/trunks/create.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/trunks/create.ts)_

## `rctl trunks delete [REF]`

Deletes a Trunk

```
USAGE
  $ rctl trunks delete [REF] [-i] [-c <value>] [-e <value>]

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Deletes a Trunk

EXAMPLES
  $ rctl trunks delete
  Deleting item 80181ca6-d4aa-4575-9375-8f72b071111... Done
```

_See code: [dist/commands/trunks/delete.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/trunks/delete.ts)_

## `rctl trunks describe [REF]`

shows details for a Trunk

```
USAGE
  $ rctl trunks describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to the Trunk

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details for a Trunk
```

_See code: [dist/commands/trunks/describe.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/trunks/describe.ts)_

## `rctl trunks get [REF]`

Shows a list of paginated Trunks or a single Trunk if ref is provided

```
USAGE
  $ rctl trunks get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  REF  optional reference to a Trunk

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server
  -s, --size=<value>      [default: 50] the number of items to return
  -x, --extended          extended output format

DESCRIPTION
  Shows a list of paginated Trunks or a single Trunk if ref is provided

EXAMPLES
  $ rctl trunks get
  Ref                                  Name   Inbound SIP URI 
  8cde8ea9-3c58-4dbe-b2cf-23c4413dd4cc Local  sip.t01.provider.net
```

_See code: [dist/commands/trunks/get.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/trunks/get.ts)_

## `rctl trunks update REF`

Updates an existing Trunk

```
USAGE
  $ rctl trunks update [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  REF  reference to an existing Trunk

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  Updates an existing Trunk

EXAMPLES
  $ rctl trunks update
  Updating Trunk T01... 80181ca6-d4aa-4575-9375-8f72b07d5555
```

_See code: [dist/commands/trunks/update.ts](https://github.com/fonoster/routr/blob/v2.1.11/dist/commands/trunks/update.ts)_
<!-- commandsstop -->