load('mod/utils/yaml_converter.js')

function ContactHelper(addressFactory, headerFactory, getProviders) {
    let providers = getProviders()

    this.getProviderContactURI = function(username) {

        for (var provider of providers) {
            if (provider.username === username) {
                //if (provider.port === undefined || provider.port == null) provider.port = 5060
                //let ca = addressFactory.createAddress("sip:" + username + "@" + provider.host + ":" + provider.port)
                let ca = addressFactory.createAddress("sip:ms@192.168.1.6:5060")
                let ch = headerFactory.createContactHeader(ca)
                return ch.getAddress().getURI()
            }
        }

        return null
    }
}