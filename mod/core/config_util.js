/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'

export default function () {
    return new ResourcesUtil().getJson('config/config.yml')
}
