const InetAddress = Java.type('java.net.InetAddress')
const version = 'v1.0'
const apiVersion = 'v1beta1'

module.exports = upSince => {
  const config = {
    system: {
      upSince,
      version,
      apiVersion,
      apiPath: `/api/${apiVersion}`
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
        provider: 'files_data_provider'
      },
      registrarIntf: 'External',
      restService: {
        keyStore: 'etc/certs/api-cert.jks',
        keyStorePassword: 'changeit',
        unsecured: false,
        bindAddr: '0.0.0.0',
        port: 4567,
        maxThreads: 200,
        minThreads: 8,
        timeoutMillis: 5000
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

  return config
}
