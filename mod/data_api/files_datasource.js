/**
 * @author Pedro Sanders
 * @since v1
 */
const { Status } = require('@routr/core/status')
const getConfig = require('@routr/core/config_util')
const isEmpty = require('@routr/utils/obj_util')
const DSUtils = require('@routr/data_api/utils')
const FilesUtil = require('@routr/utils/files_util')

const JsonPath = Java.type('com.jayway.jsonpath.JsonPath')
const System = Java.type('java.lang.System')
const NoSuchFileException = Java.type('java.nio.file.NoSuchFileException')
const JsonMappingException = Java.type('com.fasterxml.jackson.databind.JsonMappingException')

const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()

class FilesDataSource {

    constructor(config = getConfig()) {
        if (System.getenv("ROUTR_DS_PARAMETERS") !== null) {
            config.spec.dataSource.parameters = {}
            const key = System.getenv("ROUTR_DS_PARAMETERS").split("=")[0]
            if (key === 'path') {
               config.spec.dataSource.parameters.path = System.getenv("ROUTR_DS_PARAMETERS").split("=")[1]
            }
        }

        if (!config.spec.dataSource.parameters) {
            config.spec.dataSource.parameters = {}
            config.spec.dataSource.parameters.path = 'config'
        }

        this.filesPath = config.spec.dataSource.parameters.path

        // Static validation
        this.staticConfigValidation()

        // Check constrains
    }

    staticConfigValidation() {
        const resources = ['agents', 'domains', 'gateways', 'dids', 'peers', 'users']

        for(const cnt in resources) {
            try {
                const res = FilesUtil.readFile(this.filesPath + '/' + resources[cnt] + '.yml')
                const jsonObjs = DSUtils.convertToJson(res)
                for (const cntObj in jsonObjs) {
                    DSUtils.isValidEntity(jsonObjs[cntObj])
                }
            } catch(e) {
                if (e instanceof Java.type('com.fasterxml.jackson.dataformat.yaml.snakeyaml.error.MarkedYAMLException')) {
                    LOG.warn('The format of file `' + this.filesPath + '/' +  resources[cnt] + '.yml` is invalid')
                    continue
                } else {
                    LOG.warn('Unable to open configuration file `' + this.filesPath + '/' + resources[cnt] + '.yml`')
                }
            }
        }
    }

    withCollection(collection) {
        this.collection = collection;
        return this;
    }

    insert() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    get() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    find(filter = '*') {
        if (!isEmpty(filter) && !filter.equals('*')) {
            filter = "*.[?(" + filter + ")]"
        }

        let list = []

        try {
            const resource = DSUtils.convertToJson(FilesUtil.readFile(this.filesPath + '/' + this.collection + '.yml'))

            // JsonPath does not parse properly when using Json objects from JavaScript
            if(isEmpty(resource) === false) {
                list = JSON.parse(JsonPath.parse(JSON.stringify(resource)).read(filter).toJSONString())
            }

            if (isEmpty(list)) {
                return FilesDataSource.emptyResult()
            }
        } catch(e) {
            if(e instanceof NoSuchFileException ||
               e instanceof JsonMappingException)  {
                return FilesDataSource.emptyResult()
            }

            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value
            }
        }

        return {
            status: Status.OK,
            message: Status.message[Status.OK].value,
            result: FilesDataSource.getWithReferences(list)
        }
    }

    update() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    remove() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    static emptyResult() {
        return {
            status: Status.OK,
            message: Status.message[Status.OK].value,
            result: []
        }
    }

    static getWithReferences(list) {
        list.forEach(obj => {
            if (!obj.metadata.ref) {
                if (obj.kind.equals('Agent')) {
                    obj.metadata.ref = 'ag' + FilesDataSource.generateRef(obj.spec.credentials.username + obj.spec.domains[0])
                } else if (obj.kind.equals('Domain')) {
                    obj.metadata.ref =  'dm' + FilesDataSource.generateRef(obj.spec.context.domainUri)
                } else if (obj.kind.equals('Peer')) {
                    obj.metadata.ref = 'pr' + FilesDataSource.generateRef(obj.spec.credentials.username)
                } else if (obj.kind.equals('Gateway')) {
                    obj.metadata.ref = 'gw' + FilesDataSource.generateRef(obj.spec.host)
                } else if (obj.kind.equals('DID')) {
                    obj.metadata.ref = 'dd' + FilesDataSource.generateRef(obj.spec.location.telUrl)
                } else if (obj.kind.equals('User')) {
                    obj.metadata.ref = 'us' + FilesDataSource.generateRef(obj.spec.credentials.username)
                }
            }
        })
        return list
    }

    static generateRef(uniqueFactor) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(uniqueFactor))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return hash.substring(hash.length - 6).toLowerCase()
    }

}

module.exports = FilesDataSource
