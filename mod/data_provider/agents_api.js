/**
 * @author Pedro Sanders
 * @since v1
 */
import DataSource from 'data_provider/ds'
import DSUtil from 'data_provider/utils'
import FilesUtil from 'utils/files_util'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class AgentsAPI {

    constructor(resourcePath = 'config/agents.yml') {
        this.resourcePath = resourcePath
        this.schemaPath = 'etc/schemas/agents_schema.json'
        this.ds = new DataSource()

        if (!DSUtil.isValidDataSource(this.schemaPath, FilesUtil.readFile(resourcePath))) {
            throw "Invalid 'config/agents.yml' resource. Server unable to continue..."
        }
    }

    createFromJSON(jsonObj) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    updateFromJSON(jsonObj) {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    getAgents(filter) {
        let response = this.ds.withCollection('agents').find(filter)

        response.result.forEach(obj => {
            if (!obj.metadata.ref) {
                obj.metadata.ref = this.generateRef(obj.spec.credentials.username, obj.spec.domains[0])
            }
        })

        return response
    }

    getAgentsByDomain(domainUri) {
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
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
                result: agents
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getAgent(domainUri, username) {
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
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
                result: agent
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getAgentByRef(ref) {
        const resource = DSUtil.convertToJson(FilesUtil.readFile(this.resourcePath))
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
                result: agent
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    agentExist(domainUri, username) {
        const response = this.getAgent(domainUri, username)
        if (response.status == Status.OK) return true
        return false
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

    generateRef(username, domainUri) {
        let md5 = java.security.MessageDigest.getInstance("MD5")
        md5.update(java.nio.charset.StandardCharsets.UTF_8.encode(username + domainUri))
        let hash = java.lang.String.format("%032x", new java.math.BigInteger(1, md5.digest()))
        return "ag" + hash.substring(hash.length() - 6).toLowerCase()
    }
}