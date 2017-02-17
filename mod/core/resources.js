/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/utils/yaml_converter.js')

var ResourcesAPI = (() => {
    const LogManager = Packages.org.apache.logging.log4j.LogManager
    const LOG = LogManager.getLogger()
    let config
    let domains
    let agents
    let peers
    let gateways
    let dids

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

    function _findDomain(uri) {
        const domains = _getDomains()
        let domain = null
        domains.forEach(d => {
            if (d.uri.equals(uri)) {
                domain = d
            }
        })
        return domain
    }

    function _findGateway(ct) {
        const gateways = _getGateways()
        const gwAddress = ct.getOriginalRequestContact().getAddress()
        const username = gwAddress.toString().split(':')[1].split('@')[0].toString()

        for (var gateway of gateways) {
            if (gateway.username === username) { return gateway }
        }

        LOG.warn ('Gateway [' + username + '] does not exist in config/gateways.yml')
        return null
    }

    function _findUser(id) {
        const agents = _getAgents()
        const peers = _getPeers()

        for (var peer of peers) {
            if (peer.username === id) {
                return peer
            }
        }

        for (var agent of agents) {
            if (agent.username === id) {
                return agent
            }
        }

        return null
    }

    function _getConfig() {
        if(!config) {
            LOG.info("Loading config")
            config = new YamlToJsonConverter().getJson('config/config.yml')
        }
        return config
    }

    function _getDomains() {
        if(!domains) {
            LOG.info("Loading domains")
            domains = new YamlToJsonConverter().getJson('config/domains.yml')
        }
        return domains
    }

    function _getAgents() {
        if(!agents) {
            LOG.info("Loading agents")
            agents = new YamlToJsonConverter().getJson('config/agents.yml')
        }
        return agents
    }

    function _getPeers() {
        if(!peers) {
            LOG.info("Loading peers")
            peers = new YamlToJsonConverter().getJson('config/peers.yml')
        }
        return peers
    }

    function _getGateways() {
        if(!gateways) {
            LOG.info("Loading gateways")
            gateways = new YamlToJsonConverter().getJson('config/gateways.yml')
        }
        return gateways
    }

    function _getDIDs() {
        if(!dids) {
            LOG.info("Loading dids")
            dids = new YamlToJsonConverter().getJson('config/dids.yml')
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
        findDomain: _findDomain,
        reload: _reload
    }
})()