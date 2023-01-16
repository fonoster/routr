oclif-hello-world
=================

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![Downloads/week](https://img.shields.io/npm/dw/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![License](https://img.shields.io/npm/l/oclif-hello-world.svg)](https://github.com/oclif/hello-world/blob/main/package.json)

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
@routr/ctl/0.0.0 darwin-x64 node-v16.18.1
$ rctl --help [COMMAND]
USAGE
  $ rctl COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`rctl hello PERSON`](#rctl-hello-person)
* [`rctl hello world`](#rctl-hello-world)
* [`rctl help [COMMAND]`](#rctl-help-command)
* [`rctl plugins`](#rctl-plugins)
* [`rctl plugins:install PLUGIN...`](#rctl-pluginsinstall-plugin)
* [`rctl plugins:inspect PLUGIN...`](#rctl-pluginsinspect-plugin)
* [`rctl plugins:install PLUGIN...`](#rctl-pluginsinstall-plugin-1)
* [`rctl plugins:link PLUGIN`](#rctl-pluginslink-plugin)
* [`rctl plugins:uninstall PLUGIN...`](#rctl-pluginsuninstall-plugin)
* [`rctl plugins:uninstall PLUGIN...`](#rctl-pluginsuninstall-plugin-1)
* [`rctl plugins:uninstall PLUGIN...`](#rctl-pluginsuninstall-plugin-2)
* [`rctl plugins update`](#rctl-plugins-update)

## `rctl hello PERSON`

Say hello

```
USAGE
  $ rctl hello [PERSON] -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [dist/commands/hello/index.ts](https://github.com/fonoster/routr/https://github.com/fonoster/routr/blob/v0.0.0/dist/commands/hello/index.ts)_

## `rctl hello world`

Say hello world

```
USAGE
  $ rctl hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ rctl hello world
  hello world! (./src/commands/hello/world.ts)
```

## `rctl help [COMMAND]`

Display help for rctl.

```
USAGE
  $ rctl help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for rctl.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.22/src/commands/help.ts)_

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

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.12/src/commands/plugins/index.ts)_

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

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ rctl plugins:inspect myplugin
```

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
<!-- commandsstop -->
