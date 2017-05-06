/**
 * @author Pedro Sanders
 * @since v1
 */
const ArgumentParsers = Packages.net.sourceforge.argparse4j.ArgumentParsers

const parser = ArgumentParsers.newArgumentParser('sipioctl')
    .description('sipioctl controls the Sip I/O server')
    .epilog('Find more information at https://github.com/psanders/sip.io')

subparsers = parser.addSubparsers().title('Basic Commands').metavar('COMMAND')

// Get command
const getSubCmds = ['agent', 'agents', 'peer', 'peers', 'domain', 'domains', 'did', 'dids', 'gateway', 'gateways']
const get = subparsers.addParser('get').help('display a list of resources')
get.addArgument('resource').metavar(['resource']).choices(getSubCmds).help('the resource to be listed')
get.addArgument('REF').nargs('?').setDefault('none').help('Reference to resource')
get.addArgument('--filter').setDefault('{}').help('apply filter base a resource metadata ')

getEpilog=
`Examples:
    # List a all of the agents in system
    $ sipioctl get agents

    # List a single agent by ref
    $ sipioctl get agent john-4353

    # Gets peer by username
    $ sipioctl get dids --filter '{"ref": "DID0001"}' \n`

get.epilog(getEpilog)

// Location command
const loc = subparsers.addParser('location').aliases(['loc']).help('locate sip devices')

// Stop command
subparsers.addParser('stop').help('stops server')

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
        if (res.get('resource').match('agent')) getAgentsCmd(res.get('REF'), res.get('filter'))
        if (res.get('resource').match('did')) getDIDsCmd(res.get('REF'), res.get('filter'))
        if (res.get('resource').match('domain')) getDomainsCmd(res.get('REF'), res.get('filter'))
        if (res.get('resource').match('gateway')) getGatewaysCmd(res.get('REF'), res.get('filter'))
        if (res.get('resource').match('peer')) getPeersCmd(res.get('REF'), res.get('filter'))
    } else if (arg[0] == 'location' || arg[0] == 'loc') {
        cmdShowLocation()
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
