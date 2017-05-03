/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/utils/resources_manager.js')

var ResourcesAPI = (() => {
    const ReflectionToStringBuilder = Packages.org.apache.commons.lang3.builder.ReflectionToStringBuilder
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    const resourcesManager = new ResourcesManager()
    let config
    let domains
    let agents
    let peers
    let gateways
    let dids

    function valid (schema, node) {
        const errors = resourcesManager.validate(schema, node)

        if (errors.size() > 0) {
            const i = errors.iterator()
            LOG.warn('We found some errors in your resource ' + node)
            while(i.hasNext()) {
                LOG.warn(i.next())
            }
            return false
        }

        return true
    }

    function _reload(resource) {
        if (resource.equals('all') || resource == 'all') {
            config = false
            domains = false
            agents = false
            peers = false
            gateways = false
            dids = false
            _getConfig()
            _getDomains()
            _getAgents()
            _getPeers()
            _getGateways()
            _getDIDs()
        }

        switch(resource) {
            case 'config':
                config = false
                _getConfig()
                break
            case 'domains':
                domains = false
                _getDomains()
                break
            case 'agents':
                agents = false
                _getAgents()
                break
            case 'peers':
                peers = false
                _getPeers()
                break
            case 'gateways':
                gateways = false
                _getGateways()
                break
            case 'dids':
                dids = false
                _getDIDs()
                break
            default:
                throw new Packages.java.lang.RuntimeException('Unable to find resource: ' + resource)
        }
    }

    function _findDomain(domainUri) {
        const domains = _getDomains()
        let domain = null
        if (!!domains) {
            domains.forEach(d => {
                if (d.spec.context.domainUri.equals(domainUri)) {
                    domain = d
                }
            })
        }
        return domain
    }

    function _findGateway(ct) {
        const gateways = _getGateways()
        const gwUsernameHeader = ct.getRequest().getHeader('GWUsername')
        const username = gwUsernameHeader.getValue()

        if (!!gateways) {
            for (var gateway of gateways) {
                if (gateway.spec.regService.username === username) return gateway
            }
        }

        LOG.warn ('Gateway [' + username + '] does not exist in config/gateways.yml')
        return null
    }

    function _findGatewayByRef(ref) {
        const gateways = _getGateways()

        if (!!gateways) {
            for (var gateway of gateways) {
                if (gateway.metadata.ref.equals(ref)) return gateway
            }
        }

        LOG.warn ('Gateway by ref [' + ref + '] does not exist in config/gateways.yml')
        return null
    }

    function _findUser(id) {
        const agents = _getAgents()
        const peers = _getPeers()

        if (!!peers) {
            for (var peer of peers) {
                if (peer.spec.access.username === id) {
                    return peer
                }
            }
        }

        if (!!agents) {
            for (var agent of agents) {
                if (agent.spec.access.username === id) {
                    return agent
                }
            }
        }

        return null
    }

    function _findDIDByRef(ref) {
        const dids = _getDIDs()

        if (!!dids) {
            for (var did of dids) {
                if (did.metadata.ref.equals(ref)) {
                    return did
                }
            }
        }
        return null
    }

    function _getConfig() {
        if(!config) {
            LOG.info("Loading config")
            config = resourcesManager.getJson('config/config.yml')
        }
        return config
    }

    function _getDomains() {
         const v = valid('mod/utils/json-schemas/domains-schema.json', 'config/domains.yml')
         if (!v) {
             LOG.warn('Unable to load domains. Please check configuration')
             return
         }

        if(!domains) {
            LOG.info("Loading domains")
            domains = resourcesManager.getJson('config/domains.yml')
        }
        return domains
    }

    function _getAgents() {
        const v = valid('mod/utils/json-schemas/agents-schema.json', 'config/agents.yml')
        if (!v) {
            LOG.warn('Unable to load agents. Please check configuration')
            return
        }

        if(!agents) {
            LOG.info("Loading agents")
            agents = resourcesManager.getJson('config/agents.yml')
        }
        return agents
    }

    function _getPeers() {
        const v = valid('mod/utils/json-schemas/peers-schema.json', 'config/peers.yml')
        if (!v) {
            LOG.warn('Unable to load peers. Please check configuration')
            return
        }

        if(!peers) {
            LOG.info("Loading peers")
            peers = resourcesManager.getJson('config/peers.yml')
        }
        return peers
    }

    function _getGateways() {
        const v = valid('mod/utils/json-schemas/gateways-schema.json', 'config/gateways.yml')
        if (!v) {
            LOG.warn('Unable to load gateways. Please check configuration')
            return
        }

        if(!gateways) {
            LOG.info("Loading gateways")
            gateways = resourcesManager.getJson('config/gateways.yml')
        }
        return gateways
    }

    function _getDIDs() {
        const v = valid('mod/utils/json-schemas/dids-schema.json', 'config/dids.yml')
        if (!v) {
            LOG.warn('Unable to load dids. Please check configuration')
            return
        }

        if(!dids) {
            LOG.info("Loading dids")
            dids = resourcesManager.getJson('config/dids.yml')
        }
        return dids
    }

    return {
        getConfig: _getConfig,
        getDomains: _getDomains,
        getAgents: _getAgents,
        getGateways: _getGateways,
        getDIDs: _getDIDs,
        getPeers: _getPeers,
        findUser: _findUser,
        findGateway: _findGateway,
        findGatewayByRef: _findGatewayByRef,
        findDomain: _findDomain,
        findDIDByRef: _findDIDByRef,
        reload: _reload
    }
})()