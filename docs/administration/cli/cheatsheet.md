The `rctl` is a command-line interface for running commands against a Routr server. This overview covers `rctl` syntax, describes the command operations and provides common examples. For details about each command, including all the supported flags and subcommands, see the reference documentation below. This tool ships separately from the Routr server.

## Installation

To get the Routr Command-Line Tool run the following command:

```bash
npm install -g routr-ctl
```

The command-line tool is now globally accessible.

## Login to a Routr server

To login to a Routr server, use the login command.

```bash
rctl login https://127.0.0.1:4567/api/{apiVersion} -u admin -p changeit
```

> The current API version is v1beta1

## Syntax

Use the following syntax to run `rctl` commands from your terminal window:

```
rctl COMMAND [REF] [flags]
```

where `COMMAND`, `subcommand` `REF`, and `flags` are:

- `COMMAND`: Specifies the operation that you want to perform on one or more resources. For example, create, get, delete, locate(loc).

- `subcommand`: Specifies the resource type. Resource types are case-sensitive, and you can specify the singular, plural, or abbreviated forms. For example, the following commands produce the same output:

```
  $ rctl get gateway gweef506
  $ rctl get gateways gweef506
  $ rctl get gw gweef506
```

- `REF`: Specifies the reference to the resource. References are case-sensitive. For a full list, omit the reference. For example, `$ rctl get agents`.

- `flags`: Specifies optional flags. For example, you can use the --filter to further reduce the output of the `get` command .

The --filter flag uses [JsonPath](https://github.com/json-path/JsonPath) to perform the filtering. The root is always '$'.
All you need to add is the path to the property and the filter operators. For example:

```
# This returns all the Numbers in Gateway 'gweef506'
rctl get numbers --filter "@.metadata.gwRef=='gweef506'"    
```

If you need help, just run `rctl --help` from the terminal window.

```bash
$ rctl --help
usage: rctl [-h] [-v] COMMAND ...

A tool for the management of a Routr instance

named arguments:
  -h, --help             show this help message and exit
  -v, --version          print version information and quit

Commands:
  COMMAND
    get                  display a list of resources
    create (crea)        creates new resource(s)
    apply                apply changes over existing resource(s)
    delete (del)         delete an existing resource(s)
    locate (loc)         locate sip device(s)
    registry (reg)       shows gateways registrations
    proxy                run a proxy to the server (beta)
    login                sets connection info
    logout               clear session credentials
    logs                 dumps all the available system logs
    restart              restarts the engine
    stop                 stops the engine
    ping                 checks engine status
    version (ver)        obtain rctl's version information
    config               manage routr configuration

Run 'rctl COMMAND --help' for more information on a command
```

> Important: Some commands (i.e.: create, delete) are not available in the default implementation of the `resources` modules. Only persistent implementations support these commands.

### Examples: Common operations

Use the following set of examples to help you familiarize yourself with running the commonly used `rctl` operations:

`rctl locate` or `rctl loc` - Locate a sip device registered on the Routr server

```
// Locate all Sip Devices registered against a Routr server
$ rctl loc
```

`rctl registry` or `rctl reg` - Shows Gateways current registration.

```
// Shows the registry
$ rctl reg
```

`rctl get` - List one or more resources.

```
// List all numbers
$ rctl get numbers

// List all numbers that belong to gateway reference gweef506
$ rctl get numbers --filter "@.metadata.ref=='gweef506'"

// List number by reference
$ rctl get numbers dd50baa4

// List all agents
$ rctl get agents
```

`rctl create` - create a new resource.

```
// Create a new gateway(s) using a .yaml or .yml file
$ rctl create -f new-gateway.yaml
```

`rctl apply` - update an existing resource(s)

```
// Update an existing resource(s) .yaml or .yml.
$ rctl apply -f new-gateway.yaml
```

`rctl delete` - delete a resource.

```
// Delete all numbers for gateway reference gweef506
$ rctl delete numbers --filter "@.metadata.gwRef=='gweef506'"

// Delete a single agent (using delete alias)
$ rctl del agent ag3f77f6
```

## Cheat Sheet

> Create, delete, and update are only available in some implementations of the `resources` module.

### Request and store token

```
# Request authentication for subsequent commands
$ rctl login https://127.0.0.1:4567/api/{apiVersion} -u admin -p changeit
```

### Clear out the session credentials

```
# Clear session credentials
$ rctl logout
```

### Launch the Web Console

```
# The Web Console re-uses the credentials of your Command-Line Tool
rctl proxy
```

### Showing the Registry

```
# Shows all the Gateways that are currently available
$ rctl registry                                       # Shows only current registrations. You may use `reg` for short
```

### Locating SIP Devices

```
# Find all sip devices available at the location service
$ rctl locate                                         # This list does not include number-ingress-routes or domain-egress-routes
```

### Creating Resources

```
# Create new peers and agents
$ rctl create -f asterisk.yaml                        # Create Peer in file asterisk.yaml
$ rctl create -f agents-list.yaml                     # Create Agents in file agents-list.yaml
```

### Finding Resources

```
# Get Numbers
$ rctl get numbers                                          # List all available Numbers
$ rctl get number                                          # List all available Numbers
$ rctl get number --filter "@.metadata.ref=='dd50baa4'"     # Shows Number with reference 'Number0001'
$ rctl get number --filter "@.metadata.gwRef=='gweef506'"   # Shows Numbers with Gateway reference 'GW1232'

# Get agents
$ rctl get agents                                        # List all Agents
```

### Deleting Resources

```
# Delete command by refernce or filter
$ rctl delete agent ag3f77f6                             # Delete Agent by reference
$ rctl del numbers --filter '@.metadata.gwRef=gweef506'     # Delete Numbers using a filter
```

### Updating Resources

```
$ rctl apply -f asterisk.yaml                         # Create Peer in file asterisk.yaml
$ rctl apply -f agents-list.yaml                      # Create Agents in file agents-list.yaml
```

### Dump all available logs

```
$ rctl logs
```

### Restart the engine

```
# To restart the engine immediately use the --now flag
$ rctl restart --now
```

### Stop the engine

```
# To stop the engine immediately use the --now flag
$ rctl restart --now
```

### Check the engine status

```
$ rctl ping
```

### Display version information

```
$ rctl ver
```

### Manage general configuration

```
# To update configuration use the apply subommand
$ rctl config apply -f /path/to/config.yml

# To see the configuration use the describe subcommand
$ rctl config describe --full
```
