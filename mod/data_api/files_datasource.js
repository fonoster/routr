/**
 * @author Pedro Sanders
 * @since v1
 */
const { Status } = require('@routr/core/status')
const getConfig = require('@routr/core/config_util')
const isEmpty = require('@routr/utils/obj_util')
const DSUtils = require('@routr/data_api/utils')
const FilesUtil = require('@routr/utils/files_util')
const XXH = require('xxhashjs')

const JsonPath = Java.type('com.jayway.jsonpath.JsonPath')
const System = Java.type('java.lang.System')
const NoSuchFileException = Java.type('java.nio.file.NoSuchFileException')
const JsonMappingException = Java.type('com.fasterxml.jackson.databind.JsonMappingException')
const Caffeine = Java.type('com.github.benmanes.caffeine.cache.Caffeine')
const TimeUnit = Java.type('java.util.concurrent.TimeUnit')
const ReentrantLock = Java.type('java.util.concurrent.locks.ReentrantLock')
const lock = new ReentrantLock()

const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const LOG = LogManager.getLogger()
const RESOURCES = ['agents', 'domains', 'gateways', 'dids', 'peers', 'users']

class FilesDataSource {

    constructor(config = getConfig()) {
        this.cache = Caffeine.newBuilder()
          .expireAfterWrite(60, TimeUnit.MINUTES)
          .build()
        this.refs = Caffeine.newBuilder()
          .expireAfterWrite(60, TimeUnit.MINUTES)
          .build()

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
        this.resourceConstraintValidation()
    }

    staticConfigValidation() {
        for(const cnt in RESOURCES) {
            try {
                const res = FilesUtil.readFile(this.filesPath + '/' + RESOURCES[cnt] + '.yml')
                const jsonObjs = DSUtils.convertToJson(res)
                for (const cntObj in jsonObjs) {
                    DSUtils.isValidEntity(jsonObjs[cntObj])
                }
            } catch(e) {
                if (e instanceof Java.type('com.fasterxml.jackson.dataformat.yaml.snakeyaml.error.MarkedYAMLException')) {
                    LOG.warn('The format of file `' + this.filesPath + '/' +  RESOURCES[cnt] + '.yml` is invalid')
                    continue
                } else {
                    LOG.warn('Unable to open configuration file `' + this.filesPath + '/' + RESOURCES[cnt] + '.yml`')
                }
            }
        }
    }

    resourceConstraintValidation() {
        // Ensure GW for gwRef
        let response = this.withCollection('dids').find()
        response.result.forEach( did => {
            const gwRef = did.metadata.gwRef
            response = this.withCollection('gateways').get(gwRef)
            if (response.status !== Status.OK) {
                LOG.error('Gateway with ref `' + gwRef + '` does not exist.')
            }
        })

        // Ensure Domains have valid DIDs
        response = this.withCollection('domains').find()
        response.result.forEach( domain => {
            if(domain.spec.context.egressPolicy !== undefined) {
              const didRef = domain.spec.context.egressPolicy.didRef
              response = DSUtils.deepSearch(this.withCollection('dids').find(), "metadata.ref", didRef)
              if (response.status !== Status.OK) {
                  LOG.error('DID with ref `' + didRef + '` does not exist.')
              }
            }
        })

        // Ensure Agents have existing Domains
        response = this.withCollection('agents').find()
        response.result.forEach( agent => {
            const domains = agent.spec.domains
            for (const cnt in domains) {
                const domain = domains[cnt]
                response = this.withCollection('domains').find("@.spec.context.domainUri=='" + domain + "'")
                if (response.result.length === 0) {
                    LOG.error('Agent `' + agent.metadata.name + '(' + agent.spec.credentials.username
                      + ')` has a non-existent domain/s.')
                    break
                }
            }
        })
    }

    withCollection(collection) {
        this.collection = collection
        return this
    }

    insert() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    // Warn: Not very efficient. This will list all the resource before
    // finding the one it needs
    get(ref) {
        return DSUtils.deepSearch(this.find(), "metadata.ref", ref)
    }

    find(filter = '*') {
        if (!isEmpty(filter) && filter !== '*') {
            filter = "*.[?(" + filter + ")]"
        }

        let list = []

        try {
            lock.lock()
            const filePath = this.filesPath + '/' + this.collection + '.yml'
            let jsonPath = this.cache.getIfPresent(filePath)

            if (jsonPath === null) {
                const resource =  DSUtils.toJsonStr(FilesUtil.readFile(filePath))
                jsonPath = JsonPath.parse(resource)
                this.cache.put(filePath, jsonPath)
            }

            // JsonPath does not parse properly when using Json objects from JavaScript
            list = JSON.parse(jsonPath.read(filter).toJSONString())

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
        } finally {
          lock.unlock()
        }

        return {
            status: Status.OK,
            message: Status.message[Status.OK].value,
            result: this.getWithReferences(list)
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

    getWithReferences(list) {
        list.forEach(obj => {
            if (!obj.metadata.ref) {
                if (obj.kind.equals('Agent')) {
                    obj.metadata.ref = 'ag' + this.generateRef(obj.spec.credentials.username + obj.spec.domains[0])
                } else if (obj.kind.equals('Domain')) {
                    obj.metadata.ref =  'dm' + this.generateRef(obj.spec.context.domainUri)
                } else if (obj.kind.equals('Peer')) {
                    obj.metadata.ref = 'pr' + this.generateRef(obj.spec.credentials.username)
                } else if (obj.kind.equals('Gateway')) {
                    obj.metadata.ref = 'gw' + this.generateRef(obj.spec.host)
                } else if (obj.kind.equals('DID')) {
                    obj.metadata.ref = 'dd' + this.generateRef(obj.spec.location.telUrl)
                } else if (obj.kind.equals('User')) {
                    obj.metadata.ref = 'us' + this.generateRef(obj.spec.credentials.username)
                }
            }
        })
        return list
    }

    generateRef(uniqueFactor) {
        let ref = this.refs.getIfPresent(uniqueFactor)
        if (ref === null) {
          ref = XXH.h32(uniqueFactor, 0xABCD ).toString(16).toLowerCase()
          this.refs.put(uniqueFactor, ref)
        }
        return ref
    }

    static emptyResult() {
        return {
            status: Status.OK,
            message: Status.message[Status.OK].value,
            result: []
        }
    }

}

module.exports = FilesDataSource
