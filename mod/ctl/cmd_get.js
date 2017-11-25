/**
 * @author Pedro Sanders
 * @since v1
 */
import getAgents from 'ctl/cmd_get_agents'
import getDIDs from 'ctl/cmd_get_dids'
import getDomains from 'ctl/cmd_get_domains'
import getPeers from 'ctl/cmd_get_peers'
import getGateways from 'ctl/cmd_get_gateways'
import isEmpty from 'utils/obj_util'

export default class CommandGet {

    constructor(subparsers) {
        const getSubCmds = ['agent', 'agents', 'peer', 'peers', 'domain', 'domains', 'did', 'dids', 'gateway', 'gateways']
        const get = subparsers.addParser('get').help('display a list of resources')
        get.addArgument('resource').metavar(['resource']).choices(getSubCmds).help('the resource to be listed')
        get.addArgument('REF').nargs('?').setDefault('').help('reference to resource')
        get.addArgument('--filter').setDefault('*').help('apply filter base on resource metadata ')

        const getEpilog =
        `Examples:
            # Shows all the agents in the system
            $ sipioctl -- get agents

            # List a single agent by ref
            $ sipioctl -- get agent john-4353

            # Gets did using its reference
            $ sipioctl -- get dids --filter "@.metadata.ref=='DID0001'" \n`

        get.epilog(getEpilog)
    }

    run (resource, ref, filter) {
        if (resource.match('agent')) getAgents(ref, filter)
        if (resource.match('did')) getDIDs(ref, filter)
        if (resource.match('domain')) getDomains(ref, filter)
        if (resource.match('gateway')) getGateways(ref, filter)
        if (resource.match('peer')) getPeers(ref, filter)
    }
}