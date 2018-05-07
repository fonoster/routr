<h1 align="center">
  <br>
  <a href="http://github.com/fonoster/sipio"><img src="https://raw.githubusercontent.com/wiki/fonoster/sipio/images/logo.png" alt="Running Sip I/O" width="150"></a>
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

<div align="center">
   <img src="https://raw.githubusercontent.com/wiki/fonoster/sipio/images/running_sipio.gif" alt="Running Sip I/O" width=700>
</div>

</br>

[![Join the chat at https://gitter.im/sip-io/Lobby](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sip-io/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![Build Status](https://travis-ci.org/fonoster/sipio.svg?branch=master)](https://travis-ci.org/fonoster/sipio) [![DeepScan grade](https://deepscan.io/api/projects/2192/branches/11760/badge/grade.svg)](https://deepscan.io/dashboard#view=project&pid=2192&bid=11760) [![Maintainability](https://api.codeclimate.com/v1/badges/beb25546dbb26fd600d2/maintainability)](https://codeclimate.com/github/fonoster/sipio/maintainability) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Key Features

- Proxy
- Registrar Service
- Location Service
- Call Forking
- Multi-Tenancy/Multi-Domain
- Access to the PSTN Using SIP Gateways
- Transport: TCP, UDP, TLS, WebSocket
- Data Sources: Redis, Restful API, Files 
- Restful API
- Command Line Tool for Admin Operations
- Routing Capabilities
  - Intra-Domain Routing (IDR)
  - Domain Ingress Routing(DIR)
  - Domain Egress Routing (DER)
  - Peer Egress Routing (PER)
- Security
  - Digest SIP User Authentication
  - Domain Access Control List (DACL)
  - Restful service secured with TLS and JWT tokens

To learn more, read the [documentation](https://github.com/fonoster/sipio/wiki). :books:

## Quick Start

**Download the server**

| Platform | Download |
| -- | -- |
| Linux | [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M6/sipio-1.0.0-M6_linux-x64_bin.tar.gz) |  
| macOS | [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M6/sipio-1.0.0-M6_osx-x64_bin.tar.gz) |  
| Windows | [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M6/sipio-1.0.0-M6_windows-x64_bin.tar.gz), [zip](https://github.com/fonoster/sipio/releases/download/1.0.0-M6/sipio-1.0.0-M6_windows-x64_bin.zip) |  
| Docker | [img](https://hub.docker.com/r/fonoster/sipio/) |  

**Running with Docker**

```bash
docker pull fonoster/sipio
docker run -it \
    -p 4567:4567 \
    -p 5060:5060 \
    -p 5060:5060/udp \
    -p 5061-5063:5061-5063 \
    -e SIPIO_EXTERN_ADDR=${your host address} \
    fonoster/sipio
```
**Running with any other platform**

```bash
cd sipio.1.0.0-M6
./sipio
```

## Bugs and Feedback

For bugs, questions, and discussions please use the [Github Issues](https://github.com/fonoster/sipio/issues)

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/sipio/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/graphs/contributors)

## Authors
 - [Pedro Sanders](https://github.com/psanders)

## LICENSE
Copyright (C) 2018 by [Fonoster Inc](https://github.com/fonoster). MIT License (see [LICENSE](https://github.com/fonoster/sipio/blob/master/LICENSE) for details).
