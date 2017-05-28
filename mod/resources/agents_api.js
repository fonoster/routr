/**
 * @author Pedro Sanders
 * @since v1
 */
import ResourcesUtil from 'resources/utils'
import { Status } from 'resources/status'
import isEmpty from 'utils/obj_util'

export default class AgentsAPI {

    constructor() {
        this.resourcePath = 'config/agents.yml'
        this.schemaPath = 'etc/schemas/agents_schema.json'
        this.rUtil = new ResourcesUtil()

        if (!this.rUtil.isResourceValid(this.schemaPath, this.resourcePath)) {
            throw "Invalid 'config/agents.yml' resource. Server unable to continue..."
        }
    }

    getAgents(filter) {
        return this.rUtil.getObjs(this.resourcePath, filter)
    }

    getAgent(domainUri, username) {
        const resource = this.rUtil.getJson(this.resourcePath)
        let agent

        resource.forEach(obj => {
            if (obj.spec.credentials.username == username) {
                obj.spec.domains.forEach(d => {
                    if (domainUri == d) {
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

    deleteAgents() {
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