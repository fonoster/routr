<h1 align="center">
  <br>
  <a href="http://www.amitmerchant.com/electron-markdownify"><img src="https://raw.githubusercontent.com/wiki/fonoster/sipio/images/logo.png" alt="Markdownify" width="150"></a>
  <br>
  Sip I/O
  <br>
</h1>

<h4 align="center">Next-generation Sip Server.</h4>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#bugs-and-feedback">Bugs and Feedback</a> •
  <a href="#Contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

![screenshot](https://raw.githubusercontent.com/wiki/fonoster/sipio/images/starting_server.png)

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/fonoster/sipio/issues) [![Join the chat at https://gitter.im/sip-io/Lobby](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sip-io/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)


## Key Features

**Sip Server Features**

- Proxy
- Registrar Service
- Call Forking
- Location Service (In-memory)
- Multi-Tenancy
- Access to the PSTN Using SIP Gateways

**Transport**

- TCP
- UDP
- TLS
- Websocket

**Security**

- Digest SIP User Authentication
- Domain Access Control List (DACL)
- RESTful service secured with TLS and JWT tokens

**Other**

- Rest Service
- Command Line Tool for Admin Operations
- Routing: Intra-Domain Routing (IDR), Domain Ingress Routing(DIR), Domain Egress Routing (DER), Peer Egress Routing (PER)

## Quick Start

Install `Java 1.8 +`, get the binaries as [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M3/sipio.1.0.0-M3.tar.gz) or [zip](https://github.com/fonoster/sipio/releases/download/1.0.0-M3/sipio.1.0.0-M3.zip), and then from within the server's folder simply run:

```bash
./sipio
```

Alternatively, try using our experimental [docker image](https://github.com/fonoster/sipio/wiki/Running-on-Docker)

## Bugs and Feedback

For bugs, questions and discussions please use the [Github Issues](https://github.com/fonoster/sipio/issues)

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/sipio/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/graphs/contributors)

## Authors
 - [Pedro Sanders](https://github.com/psanders)

## LICENSE
Copyright (C) 2018 by [Fonoster Inc](https://github.com/fonoster). MIT License (see [LICENSE](https://github.com/fonoster/sipio/blob/master/LICENSE) for details).
