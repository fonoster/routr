/**
 * @author Pedro Sanders
 * @since v1
 */

export default class TestUtils {

    static buildAgent(name, domains, username, secret = '1234') {
        const agent = {
            apiVersion: 'v1.0',
            kind: 'Agent',
            metadata: {
                name: name
            },
            spec: {
                domains: domains,
                credentials: {
                    username: username,
                    secret: secret
                }
            }
        }
        return agent
    }


    static buildPeer(name, device, username, secret = '1234') {
        const peer = {
            apiVersion: 'v1.0',
            kind: 'Peer',
            metadata: {
                name: name
            },
            spec: {
                device: device,
                credentials: {
                    username: username,
                    secret: secret
                }
            }
        }
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
                regService: {
                    transport: 'tcp',
                    host: 'provider.net',
                    credentials: {
                        username: username,
                        secret: secret
                    }
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
