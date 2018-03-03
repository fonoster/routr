/**
 * @author Pedro Sanders
 * @since v1
 */
import { Status } from 'data_provider/status'
import getConfig from 'core/config_util'
import isEmpty from 'utils/obj_util'
import DSUtils from 'data_provider/utils'
import FilesUtil from 'utils/files_util'

const JsonPath = Packages.com.jayway.jsonpath.JsonPath

export default class DataSource {

    constructor() {
        this.config = getConfig()
    }

    withCollection(collection) {
        this.collection = collection;
        return this;
    }

    find(filter = '*') {
        if (!isEmpty(filter) && !filter.equals('*')) {
            filter = "*.[?(" + filter + ")]"
        }

        //const resource = DSUtils.convertToJson(this.config.spec.dataSource.parameters.path + '/' + this.collection + '.yml')
        const resource = DSUtils.convertToJson(FilesUtil.readFile('config/' + this.collection + '.yml'))
        let list = []

        try {
            // JsonPath does not parse properly when using Json objects from JavaScript
            list = JSON.parse(JsonPath.parse(resource).read(filter).toJSONString())

            if (isEmpty(list)) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    result: []
                }
            }
        } catch(e) {
            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value
            }
        }

        return {
            status: Status.OK,
            message: Status.message[Status.OK].value,
            result: list
        }
    }

}
