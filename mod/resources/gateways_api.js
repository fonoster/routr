/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/resources/utils.js')
load('mod/resources/status.js')

var GatewaysAPI = (() => {
    const self = this
    const rUtil = new ResourcesUtil()
    const resourcePath = 'config/gateways.yml'
    const schemaPath = 'mod/resources/schemas/gateways_schema.json'

    self.getGateways = (filter) => rUtil.getObjs(resourcePath, filter)

    self.getGateway = (ref) => {
        const resource = rUtil.getJson(resourcePath)
        let gateways

        resource.forEach(obj => {
            if (obj.metadata.ref == ref) {
                gateways = obj
            }
        })

        if (gateways != undefined) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: gateways
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    self.getGWByUsername = (username) => {
        const resource = rUtil.getJson(resourcePath)
        let gateways

        resource.forEach(obj => {
            if (obj.spec.regService.username == username) {
                gateways = obj
            }
        })

        if (gateways != undefined) {
            return {
                status: Status.OK,
                message: Status.message[Status.OK].value,
                obj: gateways
            }
        }

        return {
            status: Status.NOT_FOUND,
            message: Status.message[Status.NOT_FOUND].value
        }
    }

    self.gatewayExist = (ref) => {
        const result = self.getGateway(ref)
        if (result.status == Status.OK) return true
        return false
    }

    self.createGateway = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value
        }
    }

    self.updateGateway = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    self.deleteGateway = () => {
        return {
            status: Status.NOT_SUPPORTED,
            message: Status.message[Status.NOT_SUPPORTED].value,
        }
    }

    function _getInstance() {
        if (!rUtil.isResourceValid(schemaPath, resourcePath)) {
            throw "Invalid 'config/gateways.yml' resource. Server unable to continue..."
        }

        return self
    }

    return {
        getInstance: _getInstance
    }
})()