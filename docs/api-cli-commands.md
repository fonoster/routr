---
id: api-cli-commands
title: CLI Commands
---

`arkectl` is a command line interface for running commands against a **Arke** server. This overview covers `arkectl` syntax, describes the command operations and provides common examples. For details about each command, including all the supported flags and subcommands, see the `arkectl` reference documentation. This tool is part of Arke installation.

## Syntax

Use the following syntax to run `arkectl` commands from your terminal window:

```
arkectl COMMAND [REF] [flags]
```

where `COMMAND`, `subcommand` `REF`, and `flags` are:

- `COMMAND`: Specifies the operation that you want to perform on one or more resources. For example: create, get, delete, locate(loc).

- `subcommand`: Specifies the resource type. Resource types are case-sensitive and you can specify the singular, plural, or abbreviated forms. For example, the following commands produce the same output:

```
  $ arkectl get gateway gweef506
  $ arkectl get gateways gweef506
  $ arkectl get gw gweef506
```

- `REF`: Specifies the reference to the resource. References are case-sensitive. If the reference is omitted, details for all resources are displayed. For example: `$ arkectl get agents`.

- `flags`: Specifies optional flags. For example, you can use the --filter to further reduce the output of `get` command.

The --filter flag uses [JsonPath](https://github.com/json-path/JsonPath) to perform the filtering. The root is always '$'
so all you need to add is the path to the property and the filter operators. For example:

```
# This will return all the DIDs in Gateway 'gweef506'
./arkectl get dids --filter "@.metadata.gwRef=='gweef506'"    
```

If you need help, just run `arkectl --help` from the terminal window.

```bash
$ ./arkectl -h
usage: arkectl [-h] COMMAND ...

arkectl controls the Arke server

named arguments:
  -h, --help             show this help message and exit

Basic Commands:
  COMMAND
    get                  display a list of resources
    create (crea)        creates new resource(s)
    apply                apply changes over existing resource(s)
    delete (del)         delete an existing resource(s)
    locate (loc)         locate sip device(s)
    registry (reg)       shows gateways registrations
    system (sys)         display a list of resources
    login                sets connection info

More information at https://github.com/fonoster/arke/wiki
```

> **Important**: Some commands (ie.: create, delete) are not available in the default implementation of the `resources` modules. Only persistent implementations will allow such command.

### Examples: Common operations

Use the following set of examples to help you familiarize yourself with running the commonly used `arkectl` operations:

`arkectl locate` or `arkectl loc` - Locate a sip device registered on the Arke server

```
// Locate all Sip Devices registered against a Arke server
$ arkectl loc
```

`arkectl registry` or `arkectl reg` - Shows Gateways current registration

```
// Shows the registry
$ arkectl reg
```

`arkectl get` - List one or more resources.

```
// List all dids
$ arkectl get dids

// List all dids that belong to gateway reference gweef506
$ arkectl get dids --filter "@.metadata.ref=='gweef506'"

// List did by reference
$ arkectl get dids dd50baa4

// List all agents
$ arkectl get agents
```

`arkectl create` - create a new resource.

```
// Create a new gateway(s) using a .yaml or .yml file
$ arkectl create -f new-gateway.yaml
```

`arkectl apply` - update an existing resource(s)

```
// Update an existing resource(s) .yaml or .yml.
$ arkectl apply -f new-gateway.yaml
```

`arkectl delete` - delete a resource.

```
// Delete all did for gateway reference gweef506
$ arkectl delete dids --filter "@.metadata.gwRef=='gweef506'"

// Delete a single agent (using delete alias)
$ arkectl del agent ag3f77f6
```

## Cheat Sheet

> Create, delete, and update are only available in some implementations of the `resources` module.

### Request and store token

```
# Request authentication for subsecuent commands
$ arkectl login https://127.0.0.1/api/{apiVersion} -u admin -p changeit
```

### Showing the Registry

```
# Shows all the Gateways that are currently available
$ arkectl registry                                       # Shows only current registrations. You may use `reg` for short
```

### Locating Sip Devices

```
# Find all sip devices available at the location service
$ arkectl locate                                         # This list will not include did-ingress-routes or domain-egress-routes
```

### Creating Resources

```
# Create new peers and agents
$ arkectl create -f asterisk.yaml                        # Create Peer in file asterisk.yaml
$ arkectl create -f agents-list.yaml                     # Create Agents in file agents-list.yaml
```

### Finding Resources

```
# Get DIDs
$ arkectl get dids                                          # List all available DIDs
$ arkectl get did                                           # List all available DIDs
$ arkectl get did --filter "@.metadata.ref=='dd50baa4'"     # Shows DID with reference 'DID0001'
$ arkectl get did --filter "@.metadata.gwRef=='gweef506'"   # Shows DIDs with Gateway reference 'GW1232'

# Get agents
$ arkectl get agents                                        # List all Agents
```

### Deleting Resources

```
# Delete command by refernce or filter
$ arkectl delete agent ag3f77f6                             # Delete Agent by reference
$ arkectl del dids --filter '@.metadata.gwRef=gweef506'     # Delete DIDs using a filter
```

### Updating Resources

```
$ arkectl -- apply -f asterisk.yaml                         # Create Peer in file asterisk.yaml
$ arkectl -- apply -f agents-list.yaml                      # Create Agents in file agents-list.yaml
```
