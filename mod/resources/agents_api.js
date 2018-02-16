/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
import isEmpty from 'utils/obj_util'
import { Status } from 'resources/status'

export default class AgentsAPI {

    constructor() {
        this.resourcePath = 'config/agents.yml'
        this.schemaPath = 'etc/schemas/agents_schema.json'
        this.rUtil = new ResourcesUtil()

        if (!this.rUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/agents.yml' resource. Server unable to continue..."
        }
    }

    generateRef(username, domainUri) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(username + domainUri))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "ag" + hash.substring(hash.length() - 6).toLowerCase()
    }

    getAgents(filter) {
        let objs = this.rUtil.getObjs(this.resourcePath, filter)

        objs.obj.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.credentials.username, obj.spec.domains[0])
            }
        })

        return objs
    }

    getAgentsByDomain(domainUri) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let agents = []

        resource.forEach(obj => {
            obj.spec.domains.forEach(d => {
                if (domainUri == d) {
                    if (!obj.metadata.ref) {
                        obj.metadata.ref = this.generateRef(obj.spec.credentials.username, obj.spec.domains[0])
                    }

                    agents.push(obj)
                }
            })
        })

        if (agents.length > 0) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: agents
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getAgent(domainUri, username) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let agent

        resource.forEach(obj => {
            if (obj.spec.credentials.username == username) {
                obj.spec.domains.forEach(d => {
                    if (domainUri == d) {
                        if (!obj.metadata.ref) {
                            obj.metadata.ref = this.generateRef(obj.spec.credentials.username, obj.spec.domains[0])
                        }

                        agent = obj
                    }
                })
            }
        })

        if (!isEmpty(agent)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: agent
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getAgentByRef(ref) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let agent

        resource.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.credentials.username, obj.spec.domains[0])
            }

            if (ref == obj.metadata.ref) {
                agent = obj
            }
        })

        if (!isEmpty(agent)) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: agent
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    agentExist(domainUri, username) {
        const result = this.getAgent(domainUri, username)
        if (result.status == Status.OK) return true
        return false
    }

    createAgent() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateAgent() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    deleteAgent(ref) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    deleteAgent(domainUri, username) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    createFromJSONObj() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateFromJSONObj() {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }
}