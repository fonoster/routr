/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtil = require('@routr/data_api/utils')
const { Status } = require('@routr/core/status')
const getConfig = require('@routr/core/config_util')

const JedisPoolConfig = Packages.redis.clients.jedis.JedisPoolConfig
const JedisPool = Packages.redis.clients.jedis.JedisPool
const ObjectId = Packages.org.bson.types.ObjectId
const JsonPath = Packages.com.jayway.jsonpath.JsonPath
const InvalidPathException = Packages.com.jayway.jsonpath.InvalidPathException
const LogManager = Packages.org.apache.logging.log4j.LogManager
const LOG = LogManager.getLogger()
const badRequest = { status: Status.BAD_REQUEST, message: Status.message[Status.BAD_REQUEST].value }
const defaultRedisParameters = { host: 'localhost', port: '6379', }
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

class RedisDataSource {

    constructor(config = getConfig()) {
        const parameters = DSUtil.getParameters(config, defaultRedisParameters,
           ['host', 'port', 'secret'])

        this.jedisPool = new JedisPool(parameters.host, parameters.port)

        if (parameters.secret) {
            this.jedisPool.auth(parameters.secret)
        }

        if(this.withCollection('users').find().result.length == 0) {
            LOG.info("No user found. Creating default 'admin' user.")
            this.createDefaultUser(config.system.apiVersion)
        }
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

            return CoreUtils.buildResponse(Status.CREATED, obj.metadata.ref)
        } catch(e) {
            return CoreUtils.buildErrResponse(e)
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
            return result == null? CoreUtils.buildResponse(Status.NOT_FOUND) : CoreUtils.buildResponse(Status.OK, result)
        } catch(e) {
            return CoreUtils.buildErrResponse(e)
        } finally {
            if (jedis) {
                jedis.close()
            }
        }
    }

    find(filter) {
        let list = []
        let jedis

        try {
            jedis = this.jedisPool.getResource()
            jedis.smembers(this.collection)
                .forEach(ref =>
                    list.push(JSON.parse(jedis.get(ref))))

            if (list.length == 0) {
                return CoreUtils.buildResponse(Status.OK, [])
            }
            // JsonPath does not parse properly when using Json objects from JavaScript
            list = JsonPath.parse(JSON.stringify(list))
                .read(DSUtil.transformFilter(filter))
                    .toJSONString()

            return CoreUtils.buildResponse(Status.OK, JSON.parse(list))
        } catch(e) {
            return e instanceof InvalidPathException? CoreUtils.buildResponse(Status.BAD_REQUEST, null, e)
                : CoreUtils.buildErrResponse(e)
        } finally {
            if (jedis) {
                jedis.close()
            }
        }
    }

    update(obj) {
        if (!DSUtil.isValidEntity(obj)) {
            return badRequest
        }

        let jedis

        try {
            jedis = this.jedisPool.getResource()
            jedis.set(obj.metadata.ref, JSON.stringify(obj))

            return CoreUtils.buildResponse(Status.OK, obj.metadata.ref)
        } catch(e) {
            return e instanceof InvalidPathException? CoreUtils.buildResponse(Status.BAD_REQUEST, null, e)
                :CoreUtils.buildErrResponse(e)
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
                return CoreUtils.buildResponse(Status.NOT_FOUND)
            }

            cnt = jedis.srem(this.collection, ref)

            return cnt == 0? CoreUtils.buildResponse(Status.NOT_FOUND) : CoreUtils.buildResponse(Status.OK)
        } catch(e) {
            return CoreUtils.buildErrResponse(e)
        } finally {
            if (jedis) {
                jedis.close()
            }
        }
    }

}

module.exports = RedisDataSource
