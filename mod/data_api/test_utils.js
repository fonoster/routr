/**
 * @author Pedro Sanders
 * @since v1
 */

export default class TestUtils {

    static buildEndpoint(kind, name, username, secret = '1234') {
        const endpoint = {
            apiVersion: 'v1.0',
            metadata: {
                name: name
            },
            spec: {
                credentials: {
                    username: username,
                    secret: secret
                }
            }
        }
        endpoint.kind = kind
        return endpoint
    }

    static buildAgent(name, domains, username, secret = '1234') {
        const agent = TestUtils.buildEndpoint('Agent', name, username, secret)
        agent.spec.domains = domains
        return agent
    }

    static buildPeer(name, device, username, secret = '1234') {
         const peer = TestUtils.buildEndpoint('Peer', name, username, secret)
         peer.spec.device = device
         return peer
    }

    static buildGateway(name, username, ref = '1234', secret = '1234') {
        const gateway = {
            apiVersion: 'v1.0',
            kind: 'Gateway',
            metadata: {
                name: name,
                ref: ref
            },
            spec: {
                transport: 'tcp',
                host: 'provider.net',
                credentials: {
                    username: username,
                    secret: secret
                }
            }
        }
        return gateway
    }

    static buildDomain(name, domainUri) {
        const domain = {
            apiVersion: 'v1.0',
            kind: 'Domain',
            metadata: {
                name: name,
                userId: 'john@doe.com'
            },
            spec: {
                context: {
                    domainUri: domainUri,
                    egressPolicy: {
                        rule: '.*',
                        didRef: 'DID0001'
                    }
                }
            }
        }
        return domain
    }

    static buildDID() {
        const did = {
            apiVersion: 'v1.0',
            kind: 'DID',
            metadata: {
                gwRef: '595bc68492bccf1454883d0b',
                geoInfo: {
                  city: 'Sanford, GA',
                  country: 'United States',
                  countryISOCode: 'DR'
                }
            },
            spec: {
                location: {
                    telUrl: 'tel:61198972121',
                    aorLink: 'sip:1001@sip.local'
                }
            }
        }
        return did
    }

}
