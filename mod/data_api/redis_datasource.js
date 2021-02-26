/**
 * @author Pedro Sanders
 * @since v1
 */
const CoreUtils = require('@routr/core/utils')
const DSUtils = require('@routr/data_api/utils')
const { Status } = require('@routr/core/status')
const JedisPoolConfig = Java.type('redis.clients.jedis.JedisPoolConfig')
const JedisPool = Java.type('redis.clients.jedis.JedisPool')
const ObjectId = Java.type('org.bson.types.ObjectId')
const JsonPath = Java.type('com.jayway.jsonpath.JsonPath')
const Duration = Java.type('java.time.Duration')
const InvalidPathException = Java.type(
  'com.jayway.jsonpath.InvalidPathException'
)
const LogManager = Java.type('org.apache.logging.log4j.LogManager')
const Long = Java.type('java.lang.Long')
const LOG = LogManager.getLogger()
const defaultRedisParameters =
  'host=localhost,port=6379,max_retry=-1,retry_interval=2,timeout=500'
const defUser = {
  kind: 'User',
  metadata: {
    name: 'Default'
  },
  spec: {
    credentials: {
      username: 'admin',
      secret: 'changeit'
    }
  }
}

class RedisDataSource {
  constructor (config) {
    this.parameters = DSUtils.getParameters(config, defaultRedisParameters, [
      'host',
      'port',
      'secret',
      'max_retry',
      'retry_interval',
      'timeout'
    ])

    this.jedisPool = new JedisPool(
      this.buildPoolConfig(),
      this.parameters.host,
      parseInt(this.parameters.port),
      parseInt(this.parameters.timeout),
      this.parameters.secret
    )

    if (this.withCollection('users').find().data.length === 0) {
      LOG.info('Creating default user')
      this.createDefaultUser()
    }

    if (!this.get('config').data) {
      LOG.info('Creating default configuration')
      this.createDefaultConfig(config)
    }
  }

  getJedisConn () {
    return this.jedisPool.getResource()
  }

  buildPoolConfig () {
    const poolConfig = new JedisPoolConfig()
    poolConfig.setMaxTotal(128)
    poolConfig.setMaxIdle(128)
    poolConfig.setMinIdle(16)
    poolConfig.setTestOnBorrow(true)
    poolConfig.setTestOnReturn(true)
    poolConfig.setTestWhileIdle(true)
    poolConfig.setMinEvictableIdleTimeMillis(Duration.ofSeconds(60).toMillis())
    poolConfig.setTimeBetweenEvictionRunsMillis(
      Duration.ofSeconds(30).toMillis()
    )
    poolConfig.setNumTestsPerEvictionRun(3)
    poolConfig.setBlockWhenExhausted(true)
    return poolConfig
  }

  createDefaultUser () {
    this.insert(defUser)
  }

  createDefaultConfig (config) {
    this.set('config', config)
  }

  withCollection (collection) {
    this.collection = collection
    return this
  }

  insert (obj) {
    let jedis

    try {
      if (!obj.metadata.ref) {
        obj.metadata.ref = new ObjectId().toString()
      }

      jedis = this.getJedisConn()
      obj.metadata.createdOn = new Date().toISOString()
      obj.metadata.modifiedOn = new Date().toISOString()
      jedis.set(obj.metadata.ref, JSON.stringify(obj))

      const kind = DSUtils.getKind(obj)
      jedis.sadd(`${kind.toLowerCase()}s`, obj.metadata.ref)

      return CoreUtils.buildResponse(Status.CREATED, null, obj.metadata.ref)
    } catch (e) {
      return CoreUtils.buildErrResponse(e)
    } finally {
      if (jedis) {
        jedis.close()
      }
    }
  }

  set (key, value) {
    let jedis

    try {
      jedis = this.getJedisConn()
      jedis.set(key, JSON.stringify(value))
      return CoreUtils.buildResponse(Status.OK)
    } catch (e) {
      return CoreUtils.buildErrResponse(e)
    } finally {
      if (jedis) {
        jedis.close()
      }
    }
  }

  get (ref) {
    let jedis

    try {
      jedis = this.getJedisConn()
      const data = JSON.parse(jedis.get(ref))
      return data === null
        ? CoreUtils.buildResponse(Status.NOT_FOUND)
        : CoreUtils.buildResponse(Status.OK, null, data)
    } catch (e) {
      return CoreUtils.buildErrResponse(e)
    } finally {
      if (jedis) {
        jedis.close()
      }
    }
  }

  find (filter = '*', page = 1, itemsPerPage = Long.MAX_VALUE) {
    let list = []
    let jedis

    try {
      jedis = this.getJedisConn()
      jedis
        .smembers(this.collection)
        .forEach(ref => list.push(JSON.parse(jedis.get(ref))))

      if (list.length === 0) {
        return CoreUtils.buildResponse(Status.OK, null, [])
      }
      // JsonPath doesn't parse properly when using Json objects from JS
      list = JsonPath.parse(JSON.stringify(list))
        .read(DSUtils.transformFilter(filter))
        .toJSONString()

      return DSUtils.paginate(JSON.parse(list), page, itemsPerPage)
    } catch (e) {
      return e instanceof InvalidPathException
        ? CoreUtils.buildResponse(Status.BAD_REQUEST, 'Failed to parse filter')
        : CoreUtils.buildErrResponse(e)
    } finally {
      if (jedis) {
        jedis.close()
      }
    }
  }

  update (obj) {
    let jedis

    try {
      jedis = this.getJedisConn()
      obj.metadata.modifiedOn = new Date().toISOString()
      jedis.set(obj.metadata.ref, JSON.stringify(obj))

      return CoreUtils.buildResponse(Status.OK, null, obj.metadata.ref)
    } catch (e) {
      return e instanceof InvalidPathException
        ? CoreUtils.buildResponse(Status.BAD_REQUEST, e.toString())
        : CoreUtils.buildErrResponse(e)
    } finally {
      if (jedis) {
        jedis.close()
      }
    }
  }

  remove (ref) {
    let jedis

    try {
      jedis = this.getJedisConn()
      let cnt = jedis.del(ref)

      if (cnt === 0) {
        return CoreUtils.buildResponse(Status.NOT_FOUND)
      }

      cnt = jedis.srem(this.collection, ref)

      return cnt === 0
        ? CoreUtils.buildResponse(Status.NOT_FOUND)
        : CoreUtils.buildResponse(Status.OK)
    } catch (e) {
      return CoreUtils.buildErrResponse(e)
    } finally {
      if (jedis) {
        jedis.close()
      }
    }
  }

  flushAll () {
    let jedis
    try {
      jedis = this.getJedisConn()
      jedis.flushAll()
    } catch (e) {
      LOG.warn(e)
    } finally {
      if (jedis) {
        jedis.close()
      }
    }
  }
}

module.exports = RedisDataSource
