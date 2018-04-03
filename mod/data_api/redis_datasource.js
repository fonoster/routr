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
const badRequest = { status: Status.BAD_REQUEST, message: Status.message[Status.BAD_REQUEST].value }
const defautRedisParameters = { host: 'localhost', port: '6379', }
const defUser = {
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

export default class RedisDataSource {

    constructor(config = getConfig()) {
        let parameters

        isEmpty(config.spec.dataSource.parameters) == false?
            parameters = config.spec.dataSource.parameters: parameters = defautRedisParameters

        if (System.getenv("SIPIO_DS_PARAMETERS") != null) {
            parameters = this.getParams(System.getenv("SIPIO_DS_PARAMETERS"))
        }

        this.jedisPool = new JedisPool(parameters.host, parameters.port)

        if (parameters.secret) {
            this.jedisPool.auth(parameters.secret)
        }

        if(this.withCollection('users').find().result.length == 0) {
            LOG.info("No user found. Creating default 'admin' user.")
            this.createDefaultUser(config.system.apiVersion)
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

    createDefaultUser(apiVersion) {
        defUser.apiVersion = apiVersion
        this.insert(defUser)
    }

    withCollection(collection) {
        this.collection = collection
        return this
    }

    insert(obj) {
        let jedis

        try {
            if (!DSUtil.isValidEntity(obj)) {
                return badRequest
            }

            if (!obj.metadata.ref) {
                obj.metadata.ref = new ObjectId().toString()
            }

            jedis = this.jedisPool.getResource()
            jedis.set(obj.metadata.ref, JSON.stringify(obj))

            const kind = DSUtil.getKind(obj)
            jedis.sadd(kind.toLowerCase() + 's', obj.metadata.ref)

            return DSUtil.buildResponse(Status.CREATED, obj.metadata.ref)
        } catch(e) {
            return DSUtil.buildErrResponse(e)
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
                return DSUtil.buildResponse(Status.OK, result)
            }

            return DSUtil.buildResponse(Status.NOT_FOUND)
        } catch(e) {
            return DSUtil.buildErrResponse(e)
        } finally {
            if (jedis) {
                jedis.close()
            }
        }
    }

    find(filter = '*') {
        if (isEmpty(filter) == false && filter.equals('*') == false) {
            filter = "*.[?(" + filter + ")]"
        }

        let list = []
        let jedis

        try {
            jedis = this.jedisPool.getResource()
            jedis.smembers(this.collection)
                .forEach(ref => list.push(JSON.parse(jedis.get(ref))))

            if (list.length == 0) {
                return DSUtil.buildResponse(Status.OK, [])
            }
            // JsonPath does not parse properly when using Json objects from JavaScript
            list = JSON.parse(JsonPath.parse(JSON.stringify(list)).read(filter).toJSONString())

            return DSUtil.buildResponse(Status.OK, list)
        } catch(e) {
            if (e instanceof InvalidPathException) {
                return DSUtil.buildResponse(Status.BAD_REQUEST, e.getMessage())
            }

            return DSUtil.buildErrResponse(e)
        } finally {
            if (jedis) {
                jedis.close()
            }
        }
    }

    update(obj) {
        if (isEmpty(obj.metadata.ref) == true || DSUtil.isValidEntity(obj) == false) {
            return badRequest
        }

        let jedis

        try {
            jedis = this.jedisPool.getResource()
            jedis.set(obj.metadata.ref, JSON.stringify(obj))

            return DSUtil.buildResponse(Status.OK, obj.metadata.ref)
        } catch(e) {
            if (e instanceof InvalidPathException) {
                return DSUtil.buildResponse(Status.BAD_REQUEST, e.getMessage())
            }

            return DSUtil.buildErrResponse(e)
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
                return DSUtil.buildResponse(Status.NOT_FOUND)
            }

            cnt = jedis.srem(this.collection, ref)

            if (cnt == 0) {
                return DSUtil.buildResponse(Status.NOT_FOUND)
            }

            return DSUtil.buildResponse(Status.OK)
        } catch(e) {
            return DSUtil.buildErrResponse(e)
        } finally {
            if (jedis) {
                jedis.close()
            }
        }
    }

}
