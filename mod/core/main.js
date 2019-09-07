/**
 * @author Pedro Sanders
 * @since v1
 */
const System = Java.type('java.lang.System')
const BasicConfigurator = Java.type('org.apache.log4j.BasicConfigurator')
const NullAppender = Java.type('org.apache.log4j.varia.NullAppender')
load(`${System.getProperty('user.dir')}/libs/jvm-npm.js`)

const Server = require('@routr/core/server')
const UsersAPI = require('@routr/data_api/users_api')
const AgentsAPI = require('@routr/data_api/agents_api')
const DomainsAPI = require('@routr/data_api/domains_api')
const PeersAPI = require('@routr/data_api/peers_api')
const GatewaysAPI = require('@routr/data_api/gateways_api')
const NumbersAPI = require('@routr/data_api/numbers_api')
const DSSelector = require('@routr/data_api/ds_selector')

// Avoids old log4j and jetty logs
System.setProperty("org.eclipse.jetty.LEVEL", "WARN")
BasicConfigurator.configure(new NullAppender())

// XXX: This feals a bit like a hack. But it is ok for now.
var global = { timer }

const ds = DSSelector.getDS()
const dataAPIs = {
    UsersAPI: new UsersAPI(ds),
    AgentsAPI: new AgentsAPI(ds),
    DomainsAPI: new DomainsAPI(ds),
    NumbersAPI: new NumbersAPI(ds),
    GatewaysAPI: new GatewaysAPI(ds),
    PeersAPI: new PeersAPI(ds)
}

new Server(dataAPIs).start()
