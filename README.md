# Sip I/O

Sip I/O is a modern sip proxy, location server, and registrar that aims to be container friendly and easy to use by 
developers and VoIP implementors.

At the moment you can add your sip devices and group them using domains. You can also connect with the PSTN using a 
Sip Gateway.

## Current features include

**Sip server features**

- Proxy
- Registrar service
- Location service (In-memory)
- Rest service
- Command line tool for admin operations
- Access to the PSTN using SIP Gateways

**Transport**

- UDP
- Websocket

**Security**

- Digest SIP User authentication
- Domain Access Control List (DACL)

## Requirement

* Java 1.9 +
* Gradle

Why Java 9? As I mentioned before this is an experimental project. My objective is to test Nashorn Javascript Engine, 
and more specifically the ES6 features, in a real life scenario. These features are only available in latest and greatest 
version of Java.

## Installation

Run the following commands to download repository and get the dependencies

```bash
git clone https://github.com/psanders/sip.io.git
cd sip.io
gradle getDeps
```

You must install Java 9 and point your JAVA_HOME to your JDK 9 to run this app. You can overwrite the JAVA_HOME at the 
file `./sipio` and `./sipioctl`

## General configuration

Configuration properties

- traceLevel
- tcpPort
- udpPort
- tlsPort
- wsPort
- recordRoute
- addressInfo.[*]
- rest.port
- rest.username
- rest.password
- rest.disable
- defaultDomainAcl.deny.[*]
- defaultDomainAcl.allow.[*]  i.e: 0.0.0.0/1
- externalHost

## Configuring domains and agents

Sip devices or endpoints are known in Sip I/O as agents. For two agents to be able to call each other they must be in the 
same domain. An agent may belong to more than one domain.

Domains can be found at `config/domains.yml`. The example below enables communication between all agents at Ocean New York.

```yaml
- apiVersion: v1alpha1
  kind: Domain
  metadata:
    name: Ocean Central Office
  uri: sip.ocean.com
  outgoing:
    rule: .*
    didRef: DID0001
```

Agents can be configured at `config/agents.yml`. In the following example agent "John Doe" has access to both domains, 
Ocean New York and Ocean Texas.

```yaml
- apiVersion: v1alpha1
  kind: Agent
  metadata:
    name: John Doe
  username: john
  secret: 1234
  domains:
    - sip.ocean.com     # This must exist in config/domains.yml
```

To setup your sip device use information found in `config/agents.yml`. Also, you must use the IP of Sip I/O as the 
OUTBOUND PROXY of your sip device.

## Sending and receiving calls from the PSTN

To send and receive calls from the PSTN you must add a gateway. Gateways are define at `config/gateways.yml`. The next 
example shows the configuration for a gateway. Sip I/O will register with this Gateway using the parameter 'host'
and the parameter 'registries'.

```yaml
- apiVersion: v1alpha1
  kind: Gateway
  metadata:
    ref:  GW0001
    name: DID Logic, Inc
    zone: USA / us1
    type: Provider
  username: '96170'
  secret: yoursecret
  host: sip.yourprovider.net      # Inbound/Outbound host
  transport: udp
  registries:                     # Inbound hosts
    - sip.nyc.yourprovider.net 
```

You also need to define the DID. Incoming calls from a DID will be route to an existing agent using the 'contact' 
parameter. Please examine the following example:

```yaml
- apiVersion: v1alpha1
  kind: DID
  metadata:
    ref: DID0001
    gwRef: GW0001
    geoInfo:
      city: Columbus, GA
      country: USA
      countryISOCode: US
  telURI: 'tel:17066041487'
  aorLink: 'sip:john@sip.ocean.com'
```

Any incoming call from this DID will be route to the "Jhon Doe" @ Ocean New York.

## Running the server

To start Sip I/O just run the `./sipio` script in the root of this 
project

```bash
./sipio
```

## Using the command line tool `sipioctl`

With `sipioctl` you can perform basic operations, such as obtaining a list of agents, peers, gateways, or simply show 
connections available in the location service (registry).

```bash
$ ./sipioctl -h
usage: sipioctl [-h] COMMAND ...
sipioctl controls the Sip I/O server
optional arguments:
  -h, --help             show this help message and exit
Basic Commands:
  COMMAND
    get                  Display one or many resources
    location (loc)       Locate sip devices
    stop                 Stops server
    reload (rel)         Reload a resource(i.e domains, agents, etc...)
Find more information at https://github.com/psanders/sip.io
```

# Compatibility notes

- Successfully connected with DIDLogic using TCP, UDP and Websocket
- Incoming calls from DIDLogic to "Telephone"
- Call from and to mac sofphone "Telephone"
- Call from/to Ip Phone GXP2100 from/to "Telephone"
- Call from SIP.js (tested on Chrome) to another SIP.js
- **Unable** to call from SIP.js to "Telephone" due to codecs issues

## Author
 - [Pedro Sanders](https://github.com/psanders)

Contributions

 - Please see [Contribution Documents](https://github.com/psanders/sip.io/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/psanders/sip.io/graphs/contributors)

## Copyright
Copyright (C) 2017 by [Pedro Sanders](https://github.com/psanders). MIT License (see [LICENSE](https://github.com/psanders/sip.io/blob/master/LICENSE) for details).
