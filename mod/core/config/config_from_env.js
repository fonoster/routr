/**
 * @author Pedro Sanders
 * @since v1
 */
const System = Java.type('java.lang.System')
const flat = require('flat')
const unflatten = require('flat').unflatten
const parseBoolean = v => v != null && v.toLowerCase() === 'true'

const envsMap = new Map()
envsMap.set('USER_AGENT', 'metadata.userAgent')
envsMap.set('DATA_SOURCE_PROVIDER', 'spec.dataSource.provider')
envsMap.set('DATA_SOURCE_PARAMETERS', 'spec.dataSource.parameters')
envsMap.set('BIND_ADDR', 'spec.bindAddr')
envsMap.set('EXTERN_ADDR', 'spec.externAddr')
envsMap.set('RECORD_ROUTE', 'spec.recordRoute')
envsMap.set('REGISTRAR_INTF', 'spec.registrarIntf')
envsMap.set('USE_TO_AS_AOR', 'spec.useToAsAOR')
envsMap.set('ACCESS_CONTROL_LIST_DENY', 'spec.accessControlList.deny')
envsMap.set('ACCESS_CONTROL_LIST_ALLOW', 'spec.accessControlList.allow')
envsMap.set('REST_SERVICE_BIND_ADDR', 'spec.restService.bindAddr')
envsMap.set('REST_SERVICE_PORT', 'spec.restService.port')
envsMap.set('REST_SERVICE_MIN_THREADS', 'spec.restService.minThreads')
envsMap.set('REST_SERVICE_MAX_THREADS', 'spec.restService.maxThreads')
envsMap.set('REST_SERVICE_TIMEOUT_MILLIS', 'spec.restService.timeoutMillis')
envsMap.set('REST_SERVICE_UNSECURED', 'spec.restService.unsecured')
envsMap.set('REST_SERVICE_KEY_STORE', 'spec.restService.keyStore')
envsMap.set(
  'REST_SERVICE_KEY_STORE_PASSWORD',
  'spec.restService.keyStorePassword'
)
envsMap.set('REST_SERVICE_TRUST_STORE', 'spec.restService.trustStore')
envsMap.set(
  'REST_SERVICE_TRUST_STORE_PASSWORD',
  'spec.restService.trustStorePassword'
)
envsMap.set('SECURITY_CONTEXT_KEY_STORE', 'spec.securityContext.keyStore')
envsMap.set(
  'SECURITY_CONTEXT_KEY_STORE_PASSWORD',
  'spec.securityContext.keyStorePassword'
)
envsMap.set('SECURITY_CONTEXT_TRUST_STORE', 'spec.securityContext.trustStore')
envsMap.set(
  'SECURITY_CONTEXT_KEY_STORE_TYPE',
  'spec.securityContext.keyStoreType'
)
envsMap.set(
  'SECURITY_CONTEXT_CLIENT_AUTH_TYPE',
  'spec.securityContext.client.authType'
)
envsMap.set('SECURITY_CONTEXT_DEBUGGING', 'spec.securityContext.debugging')
envsMap.set('EX_RTP_ENGINE_ENABLED', 'spec.ex_rtpEngine.enabled')
envsMap.set('EX_RTP_ENGINE_PROTO', 'spec.ex_rtpEngine.proto')
envsMap.set('EX_RTP_ENGINE_HOST', 'spec.ex_rtpEngine.host')
envsMap.set('EX_RTP_ENGINE_PORT', 'spec.ex_rtpEngine.port')
envsMap.set('EX_CONVERT_TEL_TO_E164', 'spec.ex_convertTelToE164')
envsMap.set('EX_KAFKA_ENABLED', 'spec.ex_kafka.enabled')
envsMap.set('EX_KAFKA_BOOTSTRAP_SERVERS', 'spec.ex_kafka.bootstrapServers')
envsMap.set('EX_KAFKA_SECURITY_PROTOCOL', 'spec.ex_kafka.securityProtocol')
envsMap.set('EX_KAFKA_SASL_MECHANISM', 'spec.ex_kafka.saslMechanism')
envsMap.set('EX_KAFKA_SASL_JAAS_CONFIG', 'spec.ex_kafka.saslJaasConfig')
envsMap.set('EX_KAFKA_TOPIC', 'spec.ex_kafka.topic')
envsMap.set(
  'EX_UNIQUE_GATEWAY_PER_HOST_PORT',
  'spec.ex_uniqueGatewayPerHostPort'
)

envsMap.set('LOG4J', '')
envsMap.set('CONFIG_FILE', '')
envsMap.set('SALT', '')
envsMap.set('SALT_FILE', '')

const boolVals = [
  'SECURITY_CONTEXT_DEBUGGING',
  'RECORD_ROUTE',
  'USE_TO_AS_AOR',
  'REST_SERVICE_UNSECURED',
  'EX_RTP_ENGINE_ENABLED',
  'EX_CONVERT_TEL_TO_E164',
  'EX_UNIQUE_GATEWAY_PER_HOST_PORT'
]

// spec.transport.[*].bindAddr	Overwrites spec.bindAddr for transport entry	No
// spec.transport.[*].port	Transport port	Yes
// spec.transport.[*].protocol	Valid values are: tcp, udp, tls, sctp, ws, wss	Yes

module.exports.getConfig = () => {
  let config = {
    system: {
      env: Array.from(envsMap, ([key, value]) => {
        var a = {}
        a.var = key
        a.value = System.getenv(key)
        if (a.value) return a
      }).filter(c => c != null)
    },
    spec: {
      dataSource: {}
    }
  }

  const flatConfig = flat(config)
  const keys = Array.from(envsMap, ([key]) => key)

  keys.forEach(key => {
    const env = boolVals.includes(key)
      ? parseBoolean(System.getenv(key))
      : System.getenv(key)
    if (env && envsMap.get(key)) flatConfig[envsMap.get(key)] = env
  })

  if (System.getenv('LOCALNETS'))
    flatConfig['spec.localnets'] = System.getenv('LOCALNETS').split(',')
  if (System.getenv('SECURITY_CONTEXT_CLIENT_PROTOCOLS'))
    flatConfig['spec.securityContext.client.protocols'] = System.getenv(
      'SECURITY_CONTEXT_CLIENT_PROTOCOLS'
    ).split(',')

  return unflatten(flatConfig)
}
