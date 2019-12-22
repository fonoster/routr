/**
 * @author Pedro Sanders
 * @since v1
 */
const ObjectId = Java.type('org.bson.types.ObjectId')

class TestUtils {

    static buildEndpoint(kind, name, username, secret = '1234',
        ref = new ObjectId().toString()) {
        const endpoint = {
            apiVersion: 'v1.0',
            metadata: {
                name: name,
                ref: ref
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

    static buildAgent(name, domains, username, secret = '1234', ref = new ObjectId().toString()) {
        const agent = TestUtils.buildEndpoint('Agent', name, username, secret, ref)
        agent.spec.domains = domains
        return agent
    }

    static buildGateway(name, username, ref = new ObjectId().toString(),
        secret = '1234') {
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

    static buildDomain(name, domainUri, numberRef, ref = new ObjectId().toString()) {
        const domain = {
            apiVersion: 'v1.0',
            kind: 'Domain',
            metadata: {
                name: name,
                ref: ref
            },
            spec: {
                context: {
                    domainUri: domainUri,
                    egressPolicy: {
                        rule: '.*',
                        numberRef: numberRef
                    }
                }
            }
        }
        return domain
    }

    static buildNumber(gwRef, ref = new ObjectId().toString()) {
        const number = {
            apiVersion: 'v1.0',
            kind: 'Number',
            metadata: {
                ref: ref,
                gwRef: gwRef,
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
        return number
    }

    static buildUser(name, username, secret = '1234',
        ref = new ObjectId().toString()) {
        return {
            apiVersion: 'v1.0',
            kind: 'User',
            metadata: {
                name: name,
                ref: ref
            },
            spec: {
                credentials: {
                    username: username,
                    secret: secret
                }
            }
        }
    }

}

module.exports = TestUtils
