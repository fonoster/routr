const System = Java.type('java.lang.System')
const InetAddress = Java.type('java.net.InetAddress')
const version = 'v1.0'
const apiVersion = 'v1beta1'

module.exports = upSince => {
  const config = {
    system: {
      upSince,
      version,
      apiVersion,
      apiPath: `/api/${apiVersion}`,
      env: [
        { var: 'ROUTR_JAVA_OPTS', value: System.getenv('ROUTR_JAVA_OPTS') },
        { var: 'ROUTR_DS_PROVIDER', value: System.getenv('ROUTR_DS_PROVIDER') },
        {
          var: 'ROUTR_DS_PARAMETERS',
          value: System.getenv('ROUTR_DS_PARAMETERS')
        },
        {
          var: 'ROUTR_CONFIG_FILE',
          value: System.getenv('ROUTR_CONFIG_FILE')
        },
        {
          var: 'ROUTR_SALT',
          value: System.getenv('ROUTR_SALT')
        },
        {
          var: 'ROUTR_EXTERN_ADDR',
          value: System.getenv('ROUTR_EXTERN_ADDR')
        },
        {
          var: 'ROUTR_LOCALNETS',
          value: System.getenv('ROUTR_LOCALNETS')
        },
        {
          var: 'ROUTR_REGISTRAR_INTF',
          value: System.getenv('ROUTR_REGISTRAR_INTF')
        },
        {
          var: 'ROUTR_JS_ENGINE',
          value: System.getenv('ROUTR_JS_ENGINE')
        }
      ]
    },
    metadata: {
      userAgent: `Routr ${version}`
    },
    spec: {
      bindAddr: InetAddress.getLocalHost().getHostAddress(),
      localnets: [],
      transport: [
        { protocol: 'tcp', port: 5060 },
        { protocol: 'udp', port: 5060 }
      ],
      dataSource: {
        provider: System.getenv('ROUTR_DS_PROVIDER') || 'files_data_provider'
      },
      registrarIntf: System.getenv('ROUTR_REGISTRAR_INTF') || 'External',
      restService: {
        keyStore: 'etc/certs/api-cert.jks',
        keyStorePassword: 'changeit',
        unsecured: false,
        bindAddr: '0.0.0.0',
        port: 4567,
        maxThreads: 200,
        minThreads: 8,
        timeOutMillis: 5000
      },
      grpcService: {
        // In v1.0 This is only use for internal apis
        bind: InetAddress.getLoopbackAddress().getHostAddress(),
        port: 50099
      },
      securityContext: {
        debugging: false,
        trustStore: 'etc/certs/domains-cert.jks',
        trustStorePassword: 'changeit',
        keyStore: 'etc/certs/domains-cert.jks',
        keyStorePassword: 'changeit',
        keyStoreType: 'jks',
        client: {
          authType: 'DisabledAll',
          protocols: ['SSLv3', 'TLSv1.2', 'TLSv1.1', 'TLSv1']
        }
      },
      accessControlList: {
        allow: [],
        deny: []
      }
    }
  }

  if (System.getenv('ROUTR_LOCALNETS'))
    config.spec.localnets = System.getenv('ROUTR_LOCALNETS').split(',')
  if (System.getenv('ROUTR_EXTERN_ADDR'))
    config.spec.externAddr = System.getenv('ROUTR_EXTERN_ADDR')

  return config
}
