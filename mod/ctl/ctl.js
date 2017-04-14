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
const get = subparsers.addParser('get').help('Display one or many resources')
get.addArgument('resource').metavar(['resource']).choices(getSubCmds)
get.addArgument('ID').nargs('?').setDefault('none').help('Specific resource')

getEpilog=
`Examples:
    # List a all of the agents in system
    $ sipioctl get agents

    # Gets peer by username
    $ sipioctl get peer 9201 ...\n`

get.epilog(getEpilog)

// Location command
subparsers.addParser('location').aliases(['loc']).help('Locate sip devices')

// Stop command
subparsers.addParser('stop').help('Stops server')

// Reload command
const reload = subparsers.addParser('reload').aliases(['rel']).help('Reload a resource(i.e domains, agents, etc...)')
const reloadSubCmds = ['config', 'agents', 'peers', 'domains', 'dids', 'gateways', 'all']
reload.addArgument('resource').metavar(['resource']).choices(reloadSubCmds)

reloadEpilog=
`Examples:
    # Reload a all agents
    $ sipioctl load agents

    # Reload all resource
    $ sipioctl rel all\n`

reload.epilog(reloadEpilog)

// Originate command
const originate = subparsers.addParser('originate').help('Originate a call on behalf of a sip endpoint')
originate.addArgument('from').nargs('?').setDefault('none').help('Origin')
originate.addArgument('to').nargs('?').setDefault('none').help('Destination')
originate.addArgument('contact').nargs('?').setDefault('none').help('Actual contact')

originateEpilog=
`Use the originate command to place a call in behalf of a sip endpoint. Both, the TO and the Contact
mush be searchable by the location service/command.

Please observe that the callee will see the information of the FROM parameter but the call will be redirected
to Contact, which may not be the same.

Example:
    $ sipioctl originate sip:john@sip.ocean.com sip:janie@sip.ocean.com sip:mediaserver@sip.ocean.com`

originate.epilog(originateEpilog)

load('mod/ctl/get_agents.js')
load('mod/ctl/get_dids.js')
load('mod/ctl/get_domains.js')
load('mod/ctl/get_gateways.js')
load('mod/ctl/get_peers.js')
load('mod/ctl/cmd_location.js')
load('mod/ctl/cmd_stop.js')
load('mod/ctl/cmd_reload.js')
load('mod/ctl/cmd_originate.js')

try {
    let arg = arguments
    if (!Array.isArray(arg)) arg = [arguments]

    const res = parser.parseArgs(arg)

    if (arg[0] == 'get') {
        if (res.get('resource').match('agent')) getAgentsCmd(res.get('ID'))
        if (res.get('resource').match('did')) getDIDsCmd(res.get('ID'))
        if (res.get('resource').match('domain')) getDomainsCmd(res.get('ID'))
        if (res.get('resource').match('gateway')) getGatewaysCmd(res.get('ID'))
        if (res.get('resource').match('peer')) getPeersCmd(res.get('ID'))
    } else if (arg[0] == 'location' || arg[0] == 'loc') {
        cmdShowLocation()
    } else if (arg[0] == 'stop') {
        cmdStop()
    } else if (arg[0] == 'reload' || arg[0] == 'rel') {
        cmdReload(res.get('resource'))
    } else if (arg[0] == 'originate') {
        cmdOriginate(res.get('from'), res.get('to'), res.get('contact'))
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
