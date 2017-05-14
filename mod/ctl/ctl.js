/**
 * @author Pedro Sanders
 * @since v1
 */
const ArgumentParsers = Packages.net.sourceforge.argparse4j.ArgumentParsers

const parser = ArgumentParsers.newArgumentParser('sipioctl')
    .description('sipioctl controls the Sip I/O server')
    .epilog('Find more information at https://github.com/psanders/sip.io/wiki')

subparsers = parser.addSubparsers().title('Basic Commands').metavar('COMMAND')

// Get command
const getSubCmds = ['agent', 'agents', 'peer', 'peers', 'domain', 'domains', 'did', 'dids', 'gateway', 'gateways']
const get = subparsers.addParser('get').help('display a list of resources')
get.addArgument('resource').metavar(['resource']).choices(getSubCmds).help('the resource to be listed')
get.addArgument('REF').nargs('?').setDefault('none').help('Reference to resource')
get.addArgument('--filter').setDefault('*').help('apply filter base on resource metadata ')

getEpilog=
`Examples:
    # Shows all the agents in the system
    $ sipioctl get agents

    # List a single agent by ref
    $ sipioctl get agent john-4353

    # Gets did using its reference
    $ sipioctl get dids --filter "metadata.ref='DID0001'" \n`

get.epilog(getEpilog)

// Create command
const create = subparsers.addParser('create').aliases(['crea']).help('creates new resource(s)')
create.addArgument('-f').help('path to yaml file with a resources(s)')

createEpilog=
`Examples:
    # Creates a new agent from a yaml file
    $ sipioctl crea -f agent.yaml

    # Creates a set of gateways from a yaml file
    $ sipioctl create -f gws.yaml \n`

create.epilog(createEpilog)

// Update command
const update = subparsers.addParser('apply').help('apply changes over existing resource(s)')
update.addArgument('-f').help('path to yaml file with a resources(s)')

updateEpilog=
`Examples:
    # Apply changes over an existing agent
    $ sipioctl apply -f agent.yaml

    # Updates a set of gateways
    $ sipioctl apply -f gws.yaml \n`

update.epilog(updateEpilog)

// Delete command
const delSubCmds = ['agent', 'agents', 'peer', 'peers', 'domain', 'domains', 'did', 'dids', 'gateway', 'gateways']
const del = subparsers.addParser('delete').aliases(['del']).help('delete an existing resource(s)')
del.addArgument('resource').metavar(['resource']).choices(delSubCmds).help('type of resource (ie.: agent, domain, etc)')
del.addArgument('REF').nargs('?').help('Reference to resource')
del.addArgument('--filter').setDefault('none').help('apply filter base on resource(s) metadata ')

delEpilog=
`Examples:
    # Deletes resource type Agent using its reference
    $ sipioctl delete agent john-4353

    or use 'del' alias

    # Deletes resource type DIDs using the its parent Gateway reference
    $ sipioctl del did --filter "metadata.gwRef='GW0001'" \n`

del.epilog(delEpilog)

// Location command
const loc = subparsers.addParser('location').aliases(['loc']).help('locate sip device(s)')

// Stop command
subparsers.addParser('stop').help('stops server')

load('mod/utils/obj_util.js')
load('mod/ctl/create_resources.js')
load('mod/ctl/update_resources.js')
load('mod/ctl/delete_resource.js')
load('mod/ctl/get_agents.js')
load('mod/ctl/get_dids.js')
load('mod/ctl/get_domains.js')
load('mod/ctl/get_gateways.js')
load('mod/ctl/get_peers.js')
load('mod/ctl/cmd_location.js')
load('mod/ctl/cmd_stop.js')

try {
    let arg = arguments
    if (!Array.isArray(arg)) arg = [arguments]

    const res = parser.parseArgs(arg)

    if (arg[0] == 'get') {
        const resource = res.get('resource')
        const ref = res.get('REF')
        let filter = res.get('filter')

        if (filter.isEmpty()) filter = "*"

        if (resource.match('agent')) getAgentsCmd(ref, filter)
        if (resource.match('did')) getDIDsCmd(ref, filter)
        if (resource.match('domain')) getDomainsCmd(ref, filter)
        if (resource.match('gateway')) getGatewaysCmd(ref, filter)
        if (resource.match('peer')) getPeersCmd(ref, filter)
    } else if (arg[0] == 'create' || arg[0] == 'crea') {
        const path = res.get('f')
        createResourcesCmd(path)
    } else if (arg[0] == 'apply') {
        const path = res.get('f')
        updateResourcesCmd(path)
    } else if (arg[0] == 'location' || arg[0] == 'loc') {
        cmdShowLocation()
    } else if (arg[0] == 'delete' || arg[0] == 'del') {
        const type = res.get('resource')
        const ref = res.get('REF')
        const filter = res.get('filter')

        if (isEmpty(ref) && filter.equals('none')) {
            print("You must indicate a 'REF' or --filter")
            quit(1)
        }

        deleteResourceCmd(type, ref, filter)
    } else if (arg[0] == 'stop') {
        cmdStop()
    }
} catch(e) {
    if (e instanceof Packages.com.mashape.unirest.http.exceptions.UnirestException) {
        print ('Sip I/O server is not running')
        exit(1)
    } else {
        print(e)
        parser.handleError(e)
    }
}
