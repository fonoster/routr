/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/ctl/ctl_utils.js')
load('mod/resources/utils.js')

function updateResourcesCmd(path) {
    const rUtil = new ResourcesUtil();
    let data;
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

    const result = putWithAuth('resources', data)

    if (result.status != 200) {
         print(result.message)
         quit(1)
    }

    print('All done.')
}