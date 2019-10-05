/**
 * @author Pedro Sanders
 * @since v1
 *
 * Unit Test for the "Files Data Source"
 */
const assert = require('assert')
const FilesDataSource = require('@routr/data_api/files_datasource')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const FilesUtil = require('@routr/utils/files_util')
const DSUtils = require('@routr/data_api/utils')
const {
    Status
} = require('@routr/core/status')
const getConfig = require('@routr/core/config_util')
const config = getConfig()
// Forces data source to use its own default parameters...
delete config.spec.dataSource.parameters
const ds = new FilesDataSource(config)
const gwAPI = new GatewaysAPI(ds)

describe('Files Data Source', () => {
    it('YAML from file', function(done) {
        const jsonObj = DSUtils.convertToJson(FilesUtil.readFile('config/agents.yml'))
        assert.ok(jsonObj instanceof Object)
        done()
    })

    it('Get collections', function(done) {
        let response = ds.withCollection('agents').find()
        assert.ok(response.status === Status.OK)
        // Existing Agent
        response = ds.withCollection('agents').find("@.spec.credentials.username=='1001'")
        assert.ok(response.status === Status.OK)
        // Non-Existing Agent
        response = ds.withCollection('agents').find("@.spec.credentials.username=='mike'")
        assert.ok(response.data.length === 0)
        // Invalid filter
        response = ds.withCollection('agents').find("@.spec.credentials.username==1001'")
        assert.ok(response.status === Status.BAD_REQUEST)
        done()
    })

    it('Get gateway by host and port', function(done) {
        let response  = gwAPI.getGatewayByHostAndPort('sip.provider.net', 5090)
        assert.ok(response.status !== Status.OK)

        response  = gwAPI.getGatewayByHost('sip.provider.net')
        assert.ok(response.status === Status.OK)

        response  = gwAPI.getGatewayByHost('sip2.provider.net', 5061)
        assert.ok(response.status === Status.OK)

        done()
    })

    it('Pagination', function(done) {
        let response = ds.withCollection('agents').find(void(0), 1, 10)
        assert.ok(response.status === Status.OK)
        assert.equal(response.meta.totalItems, 3)
        done()
    })
})
