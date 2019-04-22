/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Files Data Source"
 */
import FilesDataSource from '@routr/data_api/files_datasource'
import FilesUtil from '@routr/utils/files_util'
import DSUtil from '@routr/data_api/utils'
import { Status } from '@routr/core/status'
import getConfig from '@routr/core/config_util'

export const testGroup = { name: "Files Data Source" }

const config = getConfig()
// Forces data source to use its own default parameters...
delete config.spec.dataSource.parameters

const ds = new FilesDataSource(config)

testGroup.yaml_from_file = function () {
    const jsonObj = DSUtil.convertToJson(FilesUtil.readFile('config/agents.yml'))
    assertTrue(jsonObj instanceof Object)
}

testGroup.get_collections = function () {
    let response = ds.withCollection('agents').find()
    assertTrue(response.status == Status.OK)
    // Existing Agent
    response = ds.withCollection('agents').find("@.spec.credentials.username=='1001'")
    assertTrue(response.status == Status.OK)
    // Non-Existing Agent
    response = ds.withCollection('agents').find("@.spec.credentials.username=='mike'")
    assertTrue(response.result.length == 0)
    // Invalid filter
    response = ds.withCollection('agents').find("@.spec.credentials.username==1001'")
    assertTrue(response.status == Status.BAD_REQUEST)
}
