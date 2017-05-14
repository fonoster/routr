/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')
load('mod/resources/utils.js')

function deleteResourceCmd(type, ref, filter) {
    const rUtil = new ResourcesUtil();

    const result = deleteWithAuth('resources/' + type + '/' + ref + '?filter=' + filter)

    if (result.status != 200) {
         print(result.message)
         quit(1)
    }

    print('All done.')
}