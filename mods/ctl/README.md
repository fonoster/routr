ctl
=================

Command-Line for Routr server

[![routr](https://img.shields.io/badge/routr-ctl-brightgreen.svg)](https://routr.io)
[![Version](https://img.shields.io/npm/v/@routr/ctl.svg)](https://npmjs.org/package/@routr/ctl)
[![Downloads/week](https://img.shields.io/npm/dw/@routr/ctl.svg)](https://npmjs.org/package/@routr/ctl)
[![License](https://img.shields.io/npm/l/@routr/ctl.svg)](https://github.com/fonoster/routr/blob/main/package.json)

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
@routr/ctl/2.31.4 linux-x64 node-v22.23.4
$ rctl --help [COMMAND]
USAGE
  $ rctl COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`rctl acl create`](#rctl-acl-create)
* [`rctl acl delete [REF]`](#rctl-acl-delete-ref)
* [`rctl acl describe [REF]`](#rctl-acl-describe-ref)
* [`rctl acl get [REF]`](#rctl-acl-get-ref)
* [`rctl acl update REF`](#rctl-acl-update-ref)
* [`rctl agents create`](#rctl-agents-create)
* [`rctl agents delete [REF]`](#rctl-agents-delete-ref)
* [`rctl agents describe [REF]`](#rctl-agents-describe-ref)
* [`rctl agents get [REF]`](#rctl-agents-get-ref)
* [`rctl agents update REF`](#rctl-agents-update-ref)
* [`rctl autocomplete [SHELL]`](#rctl-autocomplete-shell)
* [`rctl credentials create`](#rctl-credentials-create)
* [`rctl credentials delete [REF]`](#rctl-credentials-delete-ref)
* [`rctl credentials describe [REF]`](#rctl-credentials-describe-ref)
* [`rctl credentials get [REF]`](#rctl-credentials-get-ref)
* [`rctl credentials update REF`](#rctl-credentials-update-ref)
* [`rctl domains create`](#rctl-domains-create)
* [`rctl domains delete [REF]`](#rctl-domains-delete-ref)
* [`rctl domains describe [REF]`](#rctl-domains-describe-ref)
* [`rctl domains get [REF]`](#rctl-domains-get-ref)
* [`rctl domains update REF`](#rctl-domains-update-ref)
* [`rctl numbers create`](#rctl-numbers-create)
* [`rctl numbers delete [REF]`](#rctl-numbers-delete-ref)
* [`rctl numbers describe [REF]`](#rctl-numbers-describe-ref)
* [`rctl numbers get [REF]`](#rctl-numbers-get-ref)
* [`rctl numbers update REF`](#rctl-numbers-update-ref)
* [`rctl peers create`](#rctl-peers-create)
* [`rctl peers delete [REF]`](#rctl-peers-delete-ref)
* [`rctl peers describe [REF]`](#rctl-peers-describe-ref)
* [`rctl peers get [REF]`](#rctl-peers-get-ref)
* [`rctl peers update REF`](#rctl-peers-update-ref)
* [`rctl plugins`](#rctl-plugins)
* [`rctl plugins add PLUGIN`](#rctl-plugins-add-plugin)
* [`rctl plugins:inspect PLUGIN...`](#rctl-pluginsinspect-plugin)
* [`rctl plugins install PLUGIN`](#rctl-plugins-install-plugin)
* [`rctl plugins link PATH`](#rctl-plugins-link-path)
* [`rctl plugins remove [PLUGIN]`](#rctl-plugins-remove-plugin)
* [`rctl plugins reset`](#rctl-plugins-reset)
* [`rctl plugins uninstall [PLUGIN]`](#rctl-plugins-uninstall-plugin)
* [`rctl plugins unlink [PLUGIN]`](#rctl-plugins-unlink-plugin)
* [`rctl plugins update`](#rctl-plugins-update)
* [`rctl trace compat MANIFEST`](#rctl-trace-compat-manifest)
* [`rctl trace lint FILE`](#rctl-trace-lint-file)
* [`rctl trace replay FILE`](#rctl-trace-replay-file)
* [`rctl trace sanitize FILE`](#rctl-trace-sanitize-file)
* [`rctl trace send FILE`](#rctl-trace-send-file)
* [`rctl trace validate FILE`](#rctl-trace-validate-file)
* [`rctl trunks create`](#rctl-trunks-create)
* [`rctl trunks delete [REF]`](#rctl-trunks-delete-ref)
* [`rctl trunks describe [REF]`](#rctl-trunks-describe-ref)
* [`rctl trunks get [REF]`](#rctl-trunks-get-ref)
* [`rctl trunks update REF`](#rctl-trunks-update-ref)

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

_See code: [src/commands/acl/create.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/acl/create.ts)_

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

_See code: [src/commands/acl/delete.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/acl/delete.ts)_

## `rctl acl describe [REF]`

shows details of an ACL

```
USAGE
  $ rctl acl describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  [REF]  reference to the ACL

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details of an ACL
```

_See code: [src/commands/acl/describe.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/acl/describe.ts)_

## `rctl acl get [REF]`

Shows a list of paginated ACLs or a single ACL if a ref is provided

```
USAGE
  $ rctl acl get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  [REF]  optional reference to an ACL

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

_See code: [src/commands/acl/get.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/acl/get.ts)_

## `rctl acl update REF`

Updates an existing ACL

```
USAGE
  $ rctl acl update REF [-i] [-c <value>] [-e <value>]

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

_See code: [src/commands/acl/update.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/acl/update.ts)_

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

_See code: [src/commands/agents/create.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/agents/create.ts)_

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

_See code: [src/commands/agents/delete.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/agents/delete.ts)_

## `rctl agents describe [REF]`

shows details of an Agent

```
USAGE
  $ rctl agents describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  [REF]  reference to the Agent

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details of an Agent
```

_See code: [src/commands/agents/describe.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/agents/describe.ts)_

## `rctl agents get [REF]`

Shows a list of paginated Agents or a single Agent if ref is provided

```
USAGE
  $ rctl agents get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  [REF]  Optional Agents reference

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
  Ref                                  Name     Username Domain    Max Contacts   Privacy Enabled
  d31f5fb8-e367-42f7-9884-1a7999f53fe8 John Doe jdoe     sip.local 1              PRIVATE Yes
```

_See code: [src/commands/agents/get.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/agents/get.ts)_

## `rctl agents update REF`

Updates an existing Agent

```
USAGE
  $ rctl agents update REF [-i] [-c <value>] [-e <value>]

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

_See code: [src/commands/agents/update.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/agents/update.ts)_

## `rctl autocomplete [SHELL]`

Display autocomplete installation instructions.

```
USAGE
  $ rctl autocomplete [SHELL] [-r]

ARGUMENTS
  [SHELL]  (zsh|bash|powershell) Shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  Display autocomplete installation instructions.

EXAMPLES
  $ rctl autocomplete

  $ rctl autocomplete bash

  $ rctl autocomplete zsh

  $ rctl autocomplete powershell

  $ rctl autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v3.3.0/src/commands/autocomplete/index.ts)_

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

_See code: [src/commands/credentials/create.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/credentials/create.ts)_

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

_See code: [src/commands/credentials/delete.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/credentials/delete.ts)_

## `rctl credentials describe [REF]`

shows details for a set of Credentials

```
USAGE
  $ rctl credentials describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  [REF]  reference to the set of Credentials

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details for a set of Credentials
```

_See code: [src/commands/credentials/describe.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/credentials/describe.ts)_

## `rctl credentials get [REF]`

Shows a list of paginated Credentials or a single set if ref is provided

```
USAGE
  $ rctl credentials get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  [REF]  optional reference to a set of Credentials

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

_See code: [src/commands/credentials/get.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/credentials/get.ts)_

## `rctl credentials update REF`

Updates an existing set of Credentials

```
USAGE
  $ rctl credentials update REF [-i] [-c <value>] [-e <value>]

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

_See code: [src/commands/credentials/update.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/credentials/update.ts)_

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

_See code: [src/commands/domains/create.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/domains/create.ts)_

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

_See code: [src/commands/domains/delete.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/domains/delete.ts)_

## `rctl domains describe [REF]`

show details of a Domain

```
USAGE
  $ rctl domains describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  [REF]  reference to the Domain

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  show details of a Domain
```

_See code: [src/commands/domains/describe.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/domains/describe.ts)_

## `rctl domains get [REF]`

Shows a list of paginated Domains or a single Domain if ref is provided

```
USAGE
  $ rctl domains get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  [REF]  optional reference to a Domain

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

_See code: [src/commands/domains/get.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/domains/get.ts)_

## `rctl domains update REF`

Updates an existing Domain

```
USAGE
  $ rctl domains update REF [-i] [-c <value>] [-e <value>]

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

_See code: [src/commands/domains/update.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/domains/update.ts)_

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

_See code: [src/commands/numbers/create.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/numbers/create.ts)_

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

_See code: [src/commands/numbers/delete.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/numbers/delete.ts)_

## `rctl numbers describe [REF]`

shows details for a Number

```
USAGE
  $ rctl numbers describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  [REF]  reference to the Number

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details for a Number
```

_See code: [src/commands/numbers/describe.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/numbers/describe.ts)_

## `rctl numbers get [REF]`

Shows a list of paginated Numbers or a single Number if ref is provided

```
USAGE
  $ rctl numbers get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  [REF]  optional reference to a Number

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

_See code: [src/commands/numbers/get.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/numbers/get.ts)_

## `rctl numbers update REF`

Updates an existing set of Credentials

```
USAGE
  $ rctl numbers update REF [-i] [-c <value>] [-e <value>]

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

_See code: [src/commands/numbers/update.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/numbers/update.ts)_

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

_See code: [src/commands/peers/create.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/peers/create.ts)_

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

_See code: [src/commands/peers/delete.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/peers/delete.ts)_

## `rctl peers describe [REF]`

shows details for a Peer

```
USAGE
  $ rctl peers describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  [REF]  reference to the Peer

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details for a Peer
```

_See code: [src/commands/peers/describe.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/peers/describe.ts)_

## `rctl peers get [REF]`

Shows a list of paginated Peers or a single Peer if ref is provided

```
USAGE
  $ rctl peers get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  [REF]  optional reference to a Peer

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
  Ref                                  Name                Username   AOR                      Max Contacts   Balancing Algorithm Session Affinity 
  6f941c63-880c-419a-a72a-4a107cbaf5c5 Asterisk Conference conference sip:conference@sip.local 1              Round Robin         Yes
```

_See code: [src/commands/peers/get.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/peers/get.ts)_

## `rctl peers update REF`

Updates an existing Peer

```
USAGE
  $ rctl peers update REF [-i] [-c <value>] [-e <value>]

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

_See code: [src/commands/peers/update.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/peers/update.ts)_

## `rctl plugins`

List installed plugins.

```
USAGE
  $ rctl plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ rctl plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/index.ts)_

## `rctl plugins add PLUGIN`

Installs a plugin into rctl.

```
USAGE
  $ rctl plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into rctl.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the RCTL_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the RCTL_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ rctl plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ rctl plugins add myplugin

  Install a plugin from a github url.

    $ rctl plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ rctl plugins add someuser/someplugin
```

## `rctl plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ rctl plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ rctl plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/inspect.ts)_

## `rctl plugins install PLUGIN`

Installs a plugin into rctl.

```
USAGE
  $ rctl plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into rctl.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the RCTL_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the RCTL_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ rctl plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ rctl plugins install myplugin

  Install a plugin from a github url.

    $ rctl plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ rctl plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/install.ts)_

## `rctl plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ rctl plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ rctl plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/link.ts)_

## `rctl plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ rctl plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ rctl plugins unlink
  $ rctl plugins remove

EXAMPLES
  $ rctl plugins remove myplugin
```

## `rctl plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ rctl plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/reset.ts)_

## `rctl plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ rctl plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ rctl plugins unlink
  $ rctl plugins remove

EXAMPLES
  $ rctl plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/uninstall.ts)_

## `rctl plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ rctl plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ rctl plugins unlink
  $ rctl plugins remove

EXAMPLES
  $ rctl plugins unlink myplugin
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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.5.2/src/commands/plugins/update.ts)_

## `rctl trace compat MANIFEST`

Replays the known-good corpus through a running dispatcher (or processor) and reports every message whose outcome or outgoing headers drifted from the recording, plus the rule findings of each file. The build's compatibility test.

```
USAGE
  $ rctl trace compat MANIFEST [--against <value>] [--sip-connect] [--fail-on drift|error|warning] [--json]
    [--ascii]

ARGUMENTS
  MANIFEST  the corpus manifest (etc/corpus/manifest.yaml)

FLAGS
  --against=<value>   host:port of the dispatcher (51901) or a processor (51904); omit to lint only
  --ascii             draw with ASCII glyphs only
  --fail-on=<option>  exit 4 on drift (drift), on drift or a new error finding (error), or on drift or any new finding
                      (warning); findings the manifest declares never count
                      <options: drift|error|warning>
  --json              print the report as JSON
  --sip-connect       also evaluate the SIPconnect 1.1 rules on every file

DESCRIPTION
  Replays the known-good corpus through a running dispatcher (or processor) and reports every message whose outcome or
  outgoing headers drifted from the recording, plus the rule findings of each file. The build's compatibility test.

EXAMPLES
  $ rctl trace compat etc/corpus/manifest.yaml --against localhost:51901

  $ rctl trace compat etc/corpus/manifest.yaml --against localhost:51901 --sip-connect --fail-on drift

  $ rctl trace compat etc/corpus/manifest.yaml  # lint only
```

_See code: [src/commands/trace/compat.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trace/compat.ts)_

## `rctl trace lint FILE`

Evaluates the SIP rules on every record of one or more traces and prints each finding with its spec citation. Pass --sip-connect to add the SIPconnect 1.1 rules.

```
USAGE
  $ rctl trace lint FILE... [--sip-connect] [--fail-on error|warning] [--json] [--ascii]

ARGUMENTS
  FILE...  one or more .jsonl traces written by the dispatcher

FLAGS
  --ascii             draw with ASCII glyphs only
  --fail-on=<option>  exit 4 when a finding of this severity or worse exists
                      <options: error|warning>
  --json              print the findings as JSON
  --sip-connect       also evaluate the SIPconnect 1.1 rules

DESCRIPTION
  Evaluates the SIP rules on every record of one or more traces and prints each finding with its spec citation. Pass
  --sip-connect to add the SIPconnect 1.1 rules.

EXAMPLES
  $ rctl trace lint call.jsonl

  $ rctl trace lint traces/*.jsonl --sip-connect --fail-on warning

  $ rctl trace lint call.jsonl --json
```

_See code: [src/commands/trace/lint.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trace/lint.ts)_

## `rctl trace replay FILE`

Replays a recorded call: the ladder of every message, what each component changed, and the rule findings. Pass --sip-connect for the SIPconnect 1.1 rules and --compare to line up two recordings of the same scenario.

```
USAGE
  $ rctl trace replay FILE [-c <value>] [-s] [-v summary|ladder|path|compare|all] [--select <value>] [--columns
    <value>] [--ascii] [--fail-on rejected|warning] [--sip-connect]

ARGUMENTS
  FILE  a .jsonl trace written by the dispatcher

FLAGS
  -c, --compare=<value>   second trace to line up with the first
  -s, --static            print one page and exit; implied when stdout is not a terminal
  -v, --view=<option>     [default: summary] view to open or print
                          <options: summary|ladder|path|compare|all>
      --ascii             draw with ASCII glyphs only
      --columns=<value>   width of a static page (default: the terminal's, else 100; never above 120)
      --fail-on=<option>  exit 4 when the call has a rejected message (rejected) or a failed or warned check (warning)
                          <options: rejected|warning>
      --select=<value>    record seq to select; in static mode its hops and diff are printed
      --sip-connect       also evaluate the SIPconnect 1.1 rules

DESCRIPTION
  Replays a recorded call: the ladder of every message, what each component changed, and the rule findings. Pass
  --sip-connect for the SIPconnect 1.1 rules and --compare to line up two recordings of the same scenario.

EXAMPLES
  $ rctl trace replay call.jsonl

  $ rctl trace replay call.jsonl --compare call-before-upgrade.jsonl

  $ rctl trace replay call.jsonl --static --view ladder --select 2

  $ rctl trace replay call.jsonl --static --fail-on rejected
```

_See code: [src/commands/trace/replay.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trace/replay.ts)_

## `rctl trace sanitize FILE`

Prepares a recording for the known-good corpus: recomputes every digest response with the corpus test credentials (so it still authenticates on replay) and applies literal rewrites to numbers, hosts and addresses across the whole file.

```
USAGE
  $ rctl trace sanitize FILE --credentials <value> [--rewrite <value>...] [--out <value>]

ARGUMENTS
  FILE  a .jsonl trace written by the dispatcher

FLAGS
  --credentials=<value>  (required) a simpledata credentials.yaml; every digest username, as it reads after the
                         rewrites, must appear in it
  --out=<value>          where to write the sanitized file (default: stdout)
  --rewrite=<value>...   literal rewrite old=new, applied to every string; repeatable

DESCRIPTION
  Prepares a recording for the known-good corpus: recomputes every digest response with the corpus test credentials (so
  it still authenticates on replay) and applies literal rewrites to numbers, hosts and addresses across the whole file.

EXAMPLES
  $ rctl trace sanitize call.jsonl --credentials etc/corpus/resources/credentials.yaml --out interop/twilio/zoiper_dod-invite_twilio_20261101.jsonl

  $ rctl trace sanitize call.jsonl --credentials creds.yaml --rewrite +13055550100=+15555550100 --rewrite 203.0.113.7=10.111.220.22
```

_See code: [src/commands/trace/sanitize.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trace/sanitize.ts)_

## `rctl trace send FILE`

Sends one recorded message to a running dispatcher or processor and shows how the live answer differs from the recorded one. Useful to reproduce a routing decision against a fix without placing a call.

```
USAGE
  $ rctl trace send FILE -t <value> [--seq <value>] [--json]

ARGUMENTS
  FILE  a .jsonl trace written by the dispatcher

FLAGS
  -t, --to=<value>   (required) host:port of the Processor gRPC service (a dispatcher or a processor)
      --json         print the live answer as JSON instead of a diff
      --seq=<value>  record to send (default: the first forwarded INVITE, else the first record)

DESCRIPTION
  Sends one recorded message to a running dispatcher or processor and shows how the live answer differs from the
  recorded one. Useful to reproduce a routing decision against a fix without placing a call.

EXAMPLES
  $ rctl trace send call.jsonl --to localhost:51901

  $ rctl trace send call.jsonl --seq 7 --to connect:51904
```

_See code: [src/commands/trace/send.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trace/send.ts)_

## `rctl trace validate FILE`

Checks that every line of a trace is a record this rctl can read: valid JSON, a supported traceVersion, and the record schema.

```
USAGE
  $ rctl trace validate FILE

ARGUMENTS
  FILE  a .jsonl trace written by the dispatcher

DESCRIPTION
  Checks that every line of a trace is a record this rctl can read: valid JSON, a supported traceVersion, and the record
  schema.

EXAMPLES
  $ rctl trace validate call.jsonl
```

_See code: [src/commands/trace/validate.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trace/validate.ts)_

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

_See code: [src/commands/trunks/create.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trunks/create.ts)_

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

_See code: [src/commands/trunks/delete.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trunks/delete.ts)_

## `rctl trunks describe [REF]`

shows details for a Trunk

```
USAGE
  $ rctl trunks describe [REF] [-i] [-c <value>] [-e <value>]

ARGUMENTS
  [REF]  reference to the Trunk

FLAGS
  -c, --cacert=<value>    path to the CA certificate to verify the server
  -e, --endpoint=<value>  [default: localhost:51908] endpoint to connect to the routr server
  -i, --insecure          allow insecure connections to the routr server

DESCRIPTION
  shows details for a Trunk
```

_See code: [src/commands/trunks/describe.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trunks/describe.ts)_

## `rctl trunks get [REF]`

Shows a list of paginated Trunks or a single Trunk if ref is provided

```
USAGE
  $ rctl trunks get [REF] [-i] [-c <value>] [-e <value>] [-s <value>] [-x]

ARGUMENTS
  [REF]  optional reference to a Trunk

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

_See code: [src/commands/trunks/get.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trunks/get.ts)_

## `rctl trunks update REF`

Updates an existing Trunk

```
USAGE
  $ rctl trunks update REF [-i] [-c <value>] [-e <value>]

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

_See code: [src/commands/trunks/update.ts](https://github.com/fonoster/routr/blob/v2.31.4/mods/ctl/src/commands/trunks/update.ts)_
<!-- commandsstop -->
