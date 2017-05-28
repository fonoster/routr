/**
 * @author Pedro Sanders
 * @since v1
 */
import CtlUtils from 'ctl/ctl_utils'
import ResourcesUtil from 'resources/utils'
import isEmpty from 'utils/obj_util'

export default class CommandDel {

    constructor(subparsers) {
        const delSubCmds = ['agent', 'agents', 'peer', 'peers', 'domain', 'domains', 'did', 'dids', 'gateway', 'gateways']
        const del = subparsers.addParser('delete').aliases(['del']).help('delete an existing resource(s)')
        del.addArgument('resource').metavar(['resource']).choices(delSubCmds).help('type of resource (ie.: agent, domain, etc)')
        del.addArgument('REF').nargs('?').help('reference to resource')
        del.addArgument('--filter').setDefault('').help('apply filter base on resource(s) metadata ')

        const delEpilog=
        `Examples:
            # Deletes resource type Agent using its reference
            $ sipioctl delete agent john-4353

            or use 'del' alias

            # Deletes resource type DIDs using the its parent Gateway reference
            $ sipioctl del did --filter "@.metadata.gwRef='GW0001'" \n`

        del.epilog(delEpilog)
        this.ctlUtil = new CtlUtils()
    }

    run (resource, ref, filter) {
        const ctlUtil = this.ctlUtil

        if (isEmpty(ref) && isEmpty(filter)) {
          print("You must indicate a 'REF' or --filter")
          quit(1)
        }
        const result = ctlUtil.deleteWithAuth('resources/' + resource + '/' + ref + '?filter=' + filter)

        if (result.status != 200) {
             print(result.message)
             quit(1)
        }

        print('All done.')
    }
}