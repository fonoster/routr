/**
 * @author Pedro Sanders
 * @since v1
 */
import DSUtil from 'data_api/utils'
import { Status } from 'data_api/status'
import getConfig from 'core/config_util'
import isEmpty from 'utils/obj_util'

const Jedis = Packages.redis.clients.jedis.Jedis
const JedisPoolConfig = Packages.redis.clients.jedis.JedisPoolConfig
const JedisPool = Packages.redis.clients.jedis.JedisPool
const ObjectId = Packages.org.bson.types.ObjectId
const JsonPath = Packages.com.jayway.jsonpath.JsonPath
const InvalidPathException = Packages.com.jayway.jsonpath.InvalidPathException
const System = Packages.java.lang.System
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()

export default class RedisDataSource {

    constructor(config = getConfig()) {
        if (System.getenv("SIPIO_DS_PARAMETERS") != null) {
            config.spec.dataSource.parameters = this.getParams(System.getenv("SIPIO_DS_PARAMETERS"))
        }

        if (!config.spec.dataSource.parameters) {
            config.spec.dataSource.parameters = this.getDefaultParams()
        }

        if (!config.spec.dataSource.parameters.host) config.spec.dataSource.parameters.host = 'localhost'
        if (!config.spec.dataSource.parameters.port) config.spec.dataSource.parameters.port = '6379'
        if (!config.spec.dataSource.parameters.secret) config.spec.dataSource.parameters.secret = ''

        const parameters = config.spec.dataSource.parameters

        this.jedisPool = new JedisPool(parameters.host, parameters.port)

        if (parameters.secret) {
            this.jedisPool.auth(parameters.secret)
        }

        if(this.withCollection('users').find().result.length == 0) {
            LOG.info("No user found. Creating default 'admin' user.")
            this.createDefaultUser(config)
        }
    }

    getParams(params) {
        const parameters = {}

        params.forEach(par => {
            const key = par.split("=")[0]
            const value =  par.split("=")[1]
            switch (key) {
                case "host":
                    parameters.host = value
                    break
                case "port":
                    parameters.username = value
                    break
                case "secret":
                    parameters.secret = value
                    break
                default:
                 LOG.warn('Invalid parameter: ' + key)
            }
        })
        return parameters
    }

    getDefaultParams() {
        const parameters = {}
        parameters.host = 'localhost'
        parameters.port = '6379'
        parameters.secret = ''
        return parameters
    }

    buildPoolConfig() {
        const poolConfig = new JedisPoolConfig();
        poolConfig.setMaxTotal(128)
        poolConfig.setMaxIdle(128)
        poolConfig.setMinIdle(16)
        poolConfig.setTestOnBorrow(true)
        poolConfig.setTestOnReturn(true)
        poolConfig.setTestWhileIdle(true)
        poolConfig.setMinEvictableIdleTimeMillis(Duration.ofSeconds(60).toMillis())
        poolConfig.setTimeBetweenEvictionRunsMillis(Duration.ofSeconds(30).toMillis())
        poolConfig.setNumTestsPerEvictionRun(3)
        poolConfig.setBlockWhenExhausted(true)
        return poolConfig
    }

    createDefaultUser(config) {
        let defUser = {
            apiVersion: config.system.apiVersion,
            kind: 'User',
            metadata: {
                name: 'Ctl'
            },
            spec: {
                credentials: {
                    username: 'admin',
                    secret: 'changeit'
                }
            }
        }

        this.insert(defUser)
    }

    withCollection(collection) {
        this.collection = collection;
        return this;
    }

    insert(obj) {
        let jedis

        try {
            if (!DSUtil.isValidEntity(obj)) {
                return {
                    status: Status.BAD_REQUEST,
                    message: Status.message[Status.BAD_REQUEST].value
                }
            }

            if (!obj.metadata.ref) {
                obj.metadata.ref = new ObjectId().toString()
            }

            jedis = this.jedisPool.getResource()
            jedis.set(obj.metadata.ref, JSON.stringify(obj))

            const kind = DSUtil.getKind(obj)
            jedis.sadd(kind.toLowerCase() + 's', obj.metadata.ref)

            return {
                status: Status.CREATED,
                message: Status.message[Status.CREATED].value,
                result: obj.metadata.ref
            }
        } catch(e) {
            LOG.error(e.getMessage())

            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        } finally {
            if (jedis) {
                jedis.close()
            }
        }
    }

    get(ref) {
        let jedis

        try {
            jedis = this.jedisPool.getResource()
            const result = jedis.get(obj.metadata.ref)

            if (result != null) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    result: result
                }
            }

            return {
                status: Status.NOT_FOUND,
                message: Status.message[Status.NOT_FOUND].value,
            }
        } catch(e) {
            LOG.error(e.getMessage())

            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
         } finally {
            if (jedis) {
                jedis.close()
            }
         }
    }

    find(filter = '*') {
        if (!isEmpty(filter) && !filter.equals('*')) {
            filter = "*.[?(" + filter + ")]"
        }

        let list = []
        let jedis

        try {
            jedis = this.jedisPool.getResource()
            jedis.smembers(this.collection).forEach(ref => {
                const entry = JSON.parse(jedis.get(ref))
                list.push(entry)
            })


            if (list.length == 0) {
                return {
                    status: Status.OK,
                    message: Status.message[Status.OK].value,
                    result: []
                }
            }
            // JsonPath does not parse properly when using Json objects from JavaScript
            list = JSON.parse(JsonPath.parse(JSON.stringify(list)).read(filter).toJSONString())

            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: list
            }
        } catch(e) {
            LOG.error(e.getMessage())

            if (e instanceof InvalidPathException) {
                return {
                    status: Status.BAD_REQUEST,
                    message: Status.message[Status.BAD_REQUEST].value,
                    result: e.getMessage()
                }
            }

            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        } finally {
            if (jedis) {
                jedis.close()
            }
        }
    }

    update(obj) {
        if (!obj.metadata.ref || !DSUtil.isValidEntity(obj)) {
            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value
            }
        }

        let jedis

        try {
            jedis = this.jedisPool.getResource()
            jedis.set(obj.metadata.ref, JSON.stringify(obj))

            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: obj.metadata.ref
            }

        } catch(e) {
            LOG.error(e.getMessage())

            if (e instanceof InvalidPathException) {
                return {
                    status: Status.BAD_REQUEST,
                    message: Status.message[Status.BAD_REQUEST].value,
                    result: e.getMessage()
                }
            }

            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value,
                result: e.getMessage()
            }
        } finally {
            if (jedis) {
                jedis.close()
            }
        }
    }

    remove(ref) {
        let jedis

        try {
            jedis = this.jedisPool.getResource()
            let cnt = jedis.del(ref)

            if (cnt == 0) {
                return {
                    status: Status.NOT_FOUND,
                    message: Status.message[Status.NOT_FOUND].value,
                }
            }

            cnt = jedis.srem(this.collection, ref)

            if (cnt == 0) {
                return {
                    status: Status.NOT_FOUND,
                    message: Status.message[Status.NOT_FOUND].value,
                }
            }

            return {
                status: Status.OK,
                message: Status.message[Status.OK].value
            }
        } catch(e) {
            LOG.error(e.getMessage())

            return {
                status: Status.INTERNAL_SERVER_ERROR,
                message: Status.message[Status.INTERNAL_SERVER_ERROR].value
            }
        } finally {
            if (jedis) {
                jedis.close()
            }
        }
    }

}
