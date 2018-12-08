<h1 align="center">
  <br>
  <a href="https://routr.io"><img src="https://raw.githubusercontent.com/wiki/fonoster/routr/images/logo.png" alt="Running Routr" width="100"></a>
  <br>
  Routr
  <br>
</h1>

<h4 align="center">Next-generation Sip Server</h4>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="https://routr.io">Docs</a> •
  <a href="#bugs-and-feedback">Bugs and Feedback</a> •
  <a href="#Contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

<div align="center">
   <img src="https://raw.githubusercontent.com/fonoster/routr/master/website/static/img/routr_animation.gif" alt="Running Routr">
</div>

</br>

[![Build Status](https://travis-ci.org/fonoster/routr.svg?branch=master)](https://travis-ci.org/fonoster/routr) [![Maintainability](https://api.codeclimate.com/v1/badges/beb25546dbb26fd600d2/maintainability)](https://codeclimate.com/github/fonoster/routr/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/beb25546dbb26fd600d2/test_coverage)](https://codeclimate.com/github/fonoster/routr/test_coverage) [![Join the chat at https://gitter.im/fonoster/routr](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sip-io/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) 
<a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="license: MIT"></a>

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

To learn more, read the [documentation](https://fonoster.github.io/routr). :books:

## Quick Start

**Download the server**

| Platform | Download |
| -- | -- |
| Linux | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc1/routr-1.0.0-rc1_linux-x64_bin.tar.gz) |  
| macOS | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc1/routr-1.0.0-rc1_osx-x64_bin.tar.gz) |  
| Windows | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc1/routr-1.0.0-rc1_windows-x64_bin.tar.gz), [zip](https://github.com/fonoster/routr/releases/download/1.0.0-rc1/routr-1.0.0-rc1_windows-x64_bin.zip) |  
| Docker | [img](https://hub.docker.com/r/fonoster/routr/) |  

**Running with Docker**

```bash
docker pull fonoster/routr
docker run -it \
    -p 4567:4567 \
    -p 5060:5060 \
    -p 5060:5060/udp \
    -p 5061-5063:5061-5063 \
    -e ROUTR_EXTERN_ADDR=${your host address} \
    fonoster/routr
```
**Running with any other platform**

```bash
cd routr.1.0.0-rc1
./routr
```

## Bugs and Feedback

For bugs, questions, and discussions please use the [Github Issues](https://github.com/fonoster/routr/issues)

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/routr/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/routr/contributors)

## Authors
 - [Pedro Sanders](https://github.com/psanders)

## LICENSE
Copyright (C) 2018 by [Fonoster Inc](https://github.com/fonoster). MIT License (see [LICENSE](https://github.com/fonoster/routr/blob/master/LICENSE) for details).
