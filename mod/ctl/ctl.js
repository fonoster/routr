/**
 * @author Pedro Sanders
 * @since v1
 */
const ArgumentParsers = Packages.net.sourceforge.argparse4j.ArgumentParsers

const parser = ArgumentParsers.newArgumentParser('sipioctl')
    .description('sipioctl controls the Sip I/O server')
    .epilog('Find more information at https://github.com/psanders/sip.io')

subparsers = parser.addSubparsers().title('Basic Commands').metavar('COMMAND')

const getSubCmds = ['agent', 'agents', 'peer', 'peers', 'domain', 'domains', 'did', 'dids', 'gateway', 'gateways']

const get = subparsers.addParser('get').help('Display one or many resources')
get.addArgument('resource').metavar(['resource']).choices(getSubCmds)
get.addArgument('ID').nargs('?').setDefault('none').help('Specific resource')

getEpilog=
`Examples:
    # List a all of the agents in system
    sipioctl get agents

    # Gets peer by username
    sipioctl get peer 9201 ...\n`

get.epilog(getEpilog)

subparsers.addParser('registry').aliases(['reg']).help('Shows the gateways status')
subparsers.addParser('stop').help('Stops server')
subparsers.addParser('reload').help('Reload resources(i.e domains, agents, etc...)')

load('mod/ctl/get_agents.js')
load('mod/ctl/get_dids.js')
load('mod/ctl/get_domains.js')
load('mod/ctl/get_gateways.js')
load('mod/ctl/get_peers.js')
load('mod/ctl/cmd_registry.js')
load('mod/ctl/cmd_stop.js')
load('mod/ctl/cmd_reload.js')

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
    } else if (arg[0] == 'registry' || arg[0] == 'reg') {
        cmdShowRegistry()
    } else if (arg[0] == 'stop') {
        cmdStop()
    } else if (arg[0] == 'reload') {
        cmdReload()
    }
} catch(e) {
    print(e)
    parser.handleError(e)
    exit(1)
}
