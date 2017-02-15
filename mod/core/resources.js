/**
 * @author Pedro Sanders
 * @since v1
 */
load('mod/utils/yaml_converter.js')

function getGWFromConfig(ct) {
    const LogManager      = Java.type('org.apache.logging.log4j.LogManager')
    const LOG = LogManager.getLogger()
    const gateways = new YamlToJsonConverter().getJson('config/gateways.yml')
    const gwAddress = ct.getOriginalRequestContact().getAddress()
    const username = gwAddress.toString().split(':')[1].split('@')[0].toString()

    for (var gateway of gateways) {
        if (gateway.username === username) { return gateway }
    }

    LOG.warn ('Gateway [' + username + '] does not exist in config/gateways.yml')
    return null
}

function getUserFromConfig(username) {
    const agents = new YamlToJsonConverter().getJson('config/agents.yml')
    const peers = new YamlToJsonConverter().getJson('config/peers.yml')

    for (var peer of peers) {
        if (peer.username === username) {
            return peer
        }
    }

    for (var agent of agents) {
        if (agent.username === username) {
            return agent
        }
    }

    return null
}

function getGatewaysFromConfig() {
    return new YamlToJsonConverter().getJson('config/gateways.yml')
}

function getDIDsFromConfig() {
    return new YamlToJsonConverter().getJson('config/dids.yml')
}

function getAgentsFromConfig() {
    return new YamlToJsonConverter().getJson('config/agents.yml')
}

function getPeersFromConfig() {
    return new YamlToJsonConverter().getJson('config/peers.yml')
}

function getDomainsFromConfig() {
    return new YamlToJsonConverter().getJson('config/domains.yml')
}