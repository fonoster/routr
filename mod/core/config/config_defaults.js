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
      ex_uniqueGatewayPerHostPort: false,
      ex_convertTelToE164: false,
      bindAddr: InetAddress.getLocalHost().getHostAddress(),
      localnets: [],
      transport: [
        { protocol: 'tcp', port: 5060 },
        { protocol: 'udp', port: 5060 }
      ],
      dataSource: {
        provider: 'files_data_provider'
      },
      ex_rtpEngine: {
        enabled: false,
        proto: 'http',
        port: 8080,
        bridgeParams: {
          webToWeb: {
            ICE: 'force',
            SDES: 'off',
            flags: 'trust-address replace-origin replace-session-connection'
          },
          webToSip: {
            'transport-protocol': 'RTP/AVP',
            'rtcp-mux': 'demux',
            ICE: 'remove',
            flags: 'trust-address replace-origin replace-session-connection'
          },
          sipToWeb: {
            'transport-protocol': 'UDP/TLS/RTP/SAVP',
            'rtcp-mux': 'offer',
            ICE: 'force',
            SDES: 'off',
            flags:
              'trust-address replace-origin replace-session-connection generate-mid'
          },
          sipToSip: {
            'transport-protocol': 'RTP/AVP',
            'rtcp-mux': 'demux',
            ICE: 'remove',
            flags: 'trust-address replace-origin replace-session-connection'
          }
        }
      },
      registrarIntf: 'External',
      restService: {
        keyStore: 'etc/certs/api-cert.jks',
        keyStorePassword: 'changeit',
        trustStore: 'etc/certs/api-cert.jks',
        trustStorePassword: 'changeit',
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
