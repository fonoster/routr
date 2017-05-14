/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/resources/utils.js')
load('mod/resources/status.js')
load('mod/utils/obj_util.js')

var AgentsAPI = (() => {
    const self = this
    const rUtil = new ResourcesUtil()
    const resourcePath = 'config/agents.yml'
    const schemaPath = 'mod/resources/schemas/agents_schema.json'

    self.getAgents = filter =>  rUtil.getObjs(resourcePath, filter)

    self.getAgent = (domainUri, username) => {
        const resource = rUtil.getJson(resourcePath)
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

    self.agentExist = (domainUri, username) => {
        const result = self.getAgent(domainUri, username)
        if (result.status == Status.OK) return true
        return false
    }

    self.createAgent = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    self.updateAgent = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    self.deleteAgent = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    function _getInstance() {
        if (!rUtil.isResourceValid(schemaPath, resourcePath)) {
            throw "Invalid 'config/agents.yml' resource. Server unable to continue..."
        }

        return self
    }

    return {
        getInstance: _getInstance
    }
})()