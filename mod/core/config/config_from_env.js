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
envsMap.set('LOG4J', '')
envsMap.set('CONFIG_FILE', '')
envsMap.set('SALT', '')
envsMap.set('SALT_FILE', '')

const boolVals = [
  'SECURITY_CONTEXT_DEBUGGING',
  'RECORD_ROUTE',
  'USE_TO_AS_AOR',
  'REST_SERVICE_UNSECURED'
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
