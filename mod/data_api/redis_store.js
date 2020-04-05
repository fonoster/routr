/**
 * @author Pedro Sanders
 * @since v1
 */
const DSUtils = require('@routr/data_api/utils')
const getConfig = require('@routr/core/config_util')
const defaultRedisParameters =
  'host=localhost,port=6379,max_retry=30,retry_interval=2'

const JedisPoolConfig = Java.type('redis.clients.jedis.JedisPoolConfig')
const JedisPool = Java.type('redis.clients.jedis.JedisPool')

class RedisStore {
  constructor (config = getConfig()) {
    this.parameters = DSUtils.getParameters(config, defaultRedisParameters, [
      'host',
      'port',
      'secret',
      'max_retry',
      'retry_interval'
    ])
    this.jedisPool = new JedisPool(
      this.buildPoolConfig(),
      this.parameters.host,
      parseInt(this.parameters.port)
    )
  }

  getJedisConn () {
    const jedisConn = this.jedisPool.getResource()

    if (this.parameters.secret) {
      jedisConn.auth(this.parameters.secret)
    }

    return jedisConn
  }

  buildPoolConfig () {
    const Duration = Java.type('java.time.Duration')
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

  put (c, k, v) {
    return this.jedisFunc('hset', c, k, v)
  }

  get (c, k) {
    return this.jedisFunc('hget', c, k)
  }

  remove (c, k) {
    return this.jedisFunc('hdel', c, k)
  }

  values (c) {
    return this.jedisFunc('hgetAll', c)
      .values()
      .toArray()
  }

  keySet (c) {
    return this.jedisFunc('hgetAll', c)
      .keySet()
      .toArray()
  }

  jedisFunc (funcName, ...params) {
    let jedis

    try {
      jedis = this.getJedisConn()

      switch (params.length) {
        case 3:
          return jedis[funcName](params[0], params[1], params[2])
          break
        case 2:
          return jedis[funcName](params[0], params[1])
          break
        case 1:
          return jedis[funcName](params[0])
          break
        default:
          throw 'Wrong number of arguments'
      }
    } finally {
      if (jedis) {
        jedis.close()
      }
    }
  }
}

module.exports = RedisStore
