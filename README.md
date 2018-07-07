<!--<h1 align="center">
  <br>
  <a href="http://github.com/fonoster/arke"><img src="https://raw.githubusercontent.com/wiki/fonoster/sipio/images/logo.png" alt="Running Arke" width="150"></a>
  <br>
  Arke
  <br>
</h1>-->

<h4 align="center">Next-generation Sip Server.</h4>

<p align="center">
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg"
         alt="License: MIT">
  </a>
</p>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#bugs-and-feedback">Bugs and Feedback</a> •
  <a href="#Contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

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

To learn more, read the [documentation](https://fonoster.github.io/arke). :books:

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
docker pull fonoster/arke
docker run -it \
    -p 4567:4567 \
    -p 5060:5060 \
    -p 5060:5060/udp \
    -p 5061-5063:5061-5063 \
    -e SIPIO_EXTERN_ADDR=${your host address} \
    fonoster/arke
```
**Running with any other platform**

```bash
cd arke.1.0.0-M6
./arke
```

## Bugs and Feedback

For bugs, questions, and discussions please use the [Github Issues](https://github.com/fonoster/arke/issues)

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/arke/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/arke/contributors)

## Authors
 - [Pedro Sanders](https://github.com/psanders)

## LICENSE
Copyright (C) 2018 by [Fonoster Inc](https://github.com/fonoster). MIT License (see [LICENSE](https://github.com/fonoster/arke/blob/master/LICENSE) for details).
