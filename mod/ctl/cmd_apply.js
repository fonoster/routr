/**
 * @author Pedro Sanders
 * @since v1
 */
import CtlUtils from 'ctl/ctl_utils'
import ResourcesUtil from 'resources/utils'
import isEmpty from 'utils/obj_util'

export default class CommandApply {

    constructor(subparsers) {
        const apply = subparsers.addParser('apply').help('apply changes over existing resource(s)')
        apply.addArgument('-f').metavar(['FILE']).help('path to yaml file with a resources(s)')

        const applyEpilog=
        `Examples:
            # Apply changes over an existing agent
            $ sipioctl apply -f agent.yaml

            # Updates a set of gateways
            $ sipioctl apply -f gws.yaml \n`

        apply.epilog(applyEpilog)

        this.ctlUtils = new CtlUtils()
        this.rUtil = new ResourcesUtil()
    }

    run(path) {
        const ctlUtils = this.ctlUtils
        const rUtil = this.rUtil
        let data

        if (isEmpty(path)) {
            print("You must indicate the path to the resource")
            quit(1)
        }

        try {
            data = rUtil.getJson(path)
        } catch(e) {
            if (e instanceof java.nio.file.NoSuchFileException) {
                print("Please ensure file '" + e.getMessage() + "' exist and has proper permissions")
            } else if (e instanceof java.lang.NullPointerException) {
                print('You must indicate a file :(')
            } else {
                print('Unexpected Exception :(')
            }
            quit(1)
        }

        const result = ctlUtils.putWithAuth('resources', data)

        if (result.status != 200) {
             print(result.message)
             quit(1)
        }

        print('All done.')
    }
}