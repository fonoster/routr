# Sip I/O

Sip I/O is a sip proxy, location server, and registrar built using 
Javascript over the JVM (with Nashorn). 

At the moment you can add your sip devices and group them using domains.
You can also connect with the PSTN using a Sip Gateway.

`Disclaimer: This is an experimental project. I may or may not continue
this work in the future.`

## Current features include

Sip server features

- Proxy
- Registrar service
- Location service (In-memory)
- Rest service

Transport

- UDP 

Security

- Digest SIP User authentication
- Domain security via ACL (Work in-progress)
- I'm working on implementing TLS

## Requirement

* Java 1.9+
* Gradle

## Installation

To download repo and get the dependencies

```bash
git clone https://github.com/psanders/sip.io.git
cd sip.io
gradle getDeps
```

You must install Java 9 and point your JAVA_HOME to your JDK 9 to run 
this app. You can overwrite the JAVA_HOME at the file ./sipio.

## Configuring domains and agents

Sip devices or endpoints are known in Sip I/O as agents. For two agents
to be able to call each other they must be in the same domain. An agent
may belong to more than one domain.

Domains can be found at `config/domains.yml`. The example below
enables communication between all agents at Ocean New York.

```yml
- kind: Domain
  apiVersion: v1
  metadata:
    name: New York Office
  uri: ny.ocean.com
```

Agents can be configured at `config/agents.yml`. In the following example
agent "John Doe" has access to both domains, Ocean New York and Ocean Texas.

```yml
- kind: Agent
  apiVersion: v1
  metadata:
    name: Jhon Doe
  username: jhondoe
  secret: yoursecret
  domains:
    - ny.ocean.com  # This must be defined at config/domains.yml
    - tx.ocean.com  # This must be defined at config/domains.yml
```

To setup your sip device use information found in `config/agents.yml`.
Also, you must use the IP of Sip I/O as your OUTBOUND PROXY.

## Sending and receiving calls from the PSTN

To send and receive calls from the PSTN you must add a gateway. Gateways
are define at `config/gateways.yml`. The next example shows the configuration
for a gateway. Sip I/O will register with this Gateway using the parameter 'host'
and the parameter 'registries'.

```yml
- kind: Gateway
  apiVersion: v1
  id: '12345'
  metadata:
    name: DID Logic, Inc
    zone: USA / us1
    type: Provider
  username: '12345'
  secret: yoursecret
  host: sip.didlogic.net      # Inbound/Outbound calls
  registries:                 # Inbound calls only
    - sip.nyc.didlogic.net
```

You also need to define the DID. An incoming call from a DID will be route
to an existing agent using the 'contact' parameter. Please examine the 
following example:

```yml
- kind: DID
  apiVersion: v1
  metadata:
    city: Santiago
    country: Dominican Rep.
  e164num: 18296072077
  contact: 'sip:johndoe@ny.ocean.com'
```

Any incoming call from this DID will be route to the "Jhon Doe" @ Ocean New York.

## Running the server

To start Sip I/O just run the `./sipio` script in the root of this 
project

```bash
./sipio
```

## License

I'm not sure yet.