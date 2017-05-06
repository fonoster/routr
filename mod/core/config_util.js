/**
 * @author Pedro Sanders
 * @since v1
 */
load ('mod/resources/utils.js')

function ConfigUtil() {
    this.getConfig = () => new ResourcesUtil().getJson('config/config.yml')
}