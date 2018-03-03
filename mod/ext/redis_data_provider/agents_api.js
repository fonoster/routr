/**
 * @author Pedro Sanders
 * @since v1
 */
import DataSource from 'ext/redis_data_provider/ds'
import { Status } from 'data_provider/status'
import isEmpty from 'utils/obj_util'

export default class AgentsAPI {

    constructor(domainsAPI) {
        this.ds = new DataSource()
        this.domainsAPI = domainsAPI
    }

    createFromJSON(jsonObj) {
        try {
            for(let i = 0; i < jsonObj.spec.domains.length; i++) {
                const domain = jsonObj.spec.domains[i]

                if (!this.domainsAPI.domainExist(domain)) {
                    return {
                        status: Status.CONFLICT,
                        message: "Domain '" + domain + "' does not exist"
                    }
                }

                if(this.agentExist(domain, jsonObj.spec.credentials.username)) {
                    return {
                        status: Status.CONFLICT,
                        message: Status.message[Status.CONFLICT].value,
                    }
                }
            }

            return this.ds.insert(jsonObj)

        } catch(e) {
            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value,
                result: e.getMessage()
            }
        }
    }

    updateFromJSON(jsonObj) {
        try {
            for(let i = 0; i < jsonObj.spec.domains.length; i++) {
                const domain = jsonObj.spec.domains[i]

                if (!this.domainsAPI.domainExist(domain)) {
                    return {
                        status: Status.CONFLICT,
                        message: "Domain '" + domain + "' does not exist"
                    }
                }

                // Changing the domain is not allowed.
                if(!this.agentExist(domain, jsonObj.spec.credentials.username)) {
                    return {
                        status: Status.CONFLICT,
                        message: Status.message[Status.CONFLICT].value,
                    }
                }
            }

            return this.ds.update(jsonObj)

        } catch(e) {
            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value,
                result: e.getMessage()
            }
        }
    }

    getAgents(filter) {
        return this.ds.withCollection('agents').find(filter)
    }

    /**
     * Takes either one argument(ref) or two arguments(domainUri and username)
     */
    getAgent(arg1, arg2) {
        const response = this.getAgents()
        let agent

        if( arguments.length == 2) {
            response.result.forEach(obj => {
                if (obj.spec.credentials.username == arg2) {
                    obj.spec.domains.forEach(d => {
                        if (arg1 == d) {
                            agent = obj
                        }
                    })
                }
            })
        } else {
            response.result.forEach(obj => {
                if (obj.metadata.ref == arg1) {
                    agent = obj
                }
            })
        }

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
            return this.ds.withCollection('agents').remove(ref)
        } catch(e) {
            return {
                status: Status.BAD_REQUEST,
                message: Status.message[Status.BAD_REQUEST].value,
                result: e.getMessage()
            }
        }
    }
}