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
        const domains = JSON.stringify(jsonObj.spec.domains).replaceAll("\"","'")
        let response = this.ds.withCollection('domains').find("@.spec.context.domainUri in " + domains)

        if (response.result.length != jsonObj.spec.domains.length) {
            return {
                status: Status.CONFLICT,
                message: Status.message[409.1].value
            }
        }

        response = this.ds.withCollection('agents').find("@.spec.credentials.username=='"
            + jsonObj.spec.credentials.username + "'"
                + " && (@.spec.domains subsetof " + domains + " || "
                    + domains + " subsetof  @.spec.domains)")

        if (response.result.length > 0) {
            return {
                status: Status.CONFLICT,
                message: Status.message[Status.CONFLICT].value,
            }
        }

        return this.ds.insert(jsonObj)
    }

    updateFromJSON(jsonObj) {
        const domains = JSON.stringify(jsonObj.spec.domains).replaceAll("\"","'")
        let response = this.ds.withCollection('domains').find("@.spec.context.domainUri in " + domains)

        if (response.result.length != jsonObj.spec.domains.length) {
            return {
                status: Status.CONFLICT,
                message: Status.message[409.1].value
            }
        }
        response = this.ds.withCollection('agents').find("@.spec.credentials.username=='"
            + jsonObj.spec.credentials.username + "'"
                + " && (@.spec.domains subsetof " + domains + " || "
                    + domains + " subsetof  @.spec.domains)")

        if (response.result.length == 0) {
            return {
                status: Status.NOT_FOUND,
                message: Status.message[Status.NOT_FOUND].value,
            }
        }

        return this.ds.update(jsonObj)
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
        return this.ds.withCollection('agents').remove(ref)
    }
}