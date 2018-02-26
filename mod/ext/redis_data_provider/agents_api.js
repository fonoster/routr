/**
 * @author Pedro Sanders
 * @since v1
 */
import DataSource from 'ext/redis_data_provider/ds'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class AgentsAPI {

    constructor() {
        this.ds = new DataSource()
    }

    createFromJSON(jsonObj) {
        // Ensure jsonObj is valid and user does not already exist
        try {
            const response = this.ds.insert(jsonObj)

            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: response.result
            }
        } catch(e) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: e.getMessage()
            }
        }
    }

    updateFromJSON(jsonObj) {
        // Ensure jsonObj is valid and user already exist
        try {
            const response = this.ds.update(jsonObj)

            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                result: response.result
            }
        } catch(e) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: e.getMessage()
            }
        }
    }

    getAgents(filter) {
        return this.ds.withCollection('agents').find(filter)
    }

    getAgent(domainUri, username) {
        const response = this.getAgents()
        let agent

        response.result.forEach(obj => {
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
                result: agent
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    getAgentByRef(ref) {
        const response = this.getAgents()
        let agent

        response.result.forEach(obj => {
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
        try {
            this.ds.withCollection('agents').remove(ref)

            return {
                status: Status.OK,
                message: Status.message[Status.OK].value
            }
        } catch(e) {
            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value
            }
        }
    }
}