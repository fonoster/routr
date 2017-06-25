[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/fonoster/sipio/issues) [![Join the chat at https://gitter.im/sip-io/Lobby](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sip-io/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# Sip I/O: Next-generation Sip Server

<a href="https://github.com/fonoster/sipio"><img src="https://raw.githubusercontent.com/wiki/fonoster/sipio/images/logo.png" align="left" hspace="10" vspace="5" width="80"></a>

**Sip I/O** is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators. It also provides with capabilities that are suitable for the enterprise and personal needs. For a list of features and documentation about the project please visit the [wiki](https://github.com/fonoster/sipio/wiki/Home). To get involve in the development of this project, please contact us at [@fonoster](https://twitter.com/fonoster).

## What is it useful for?

- [x] Simple call setup for sip devices
- [x] WebRTC signaling server
- [x] Signaling for chat applications
- [x] Multi-tenant VOIP network setup
- [x] Frontend for Asterisk or any Media Server
- [ ] Presence
- [ ] Load balancing

## Key Concepts

**Resources**

| Concept | Description |
| -- | -- |
| Agents  | Agents represent SIP endpoints such as softphones and IP phones                         |
| Domains | Use Domains to place Agents withing the same context                                    |
| Peers   | Peers are similar than Agents, but they are not bound to a Domain (ie.: a media server) |
| Gateway | A Gateway is a SIP entity that allows Sip I/O to connect to the PSTN                    |
| DID     | Routes and translate calls between the PSTN and Sip I/O.                                |

**Routing Method**

| Concept | Description |
| -- | -- |
| Intra-Domain Routing (IDR)   | Routing within the Domain |
| Domain Ingress Routing (DIR) | Calls from PSTN to Domain |
| Domain Egress Routing (DER)  | Calls from Agent to PSTN  |
| Peer Egress Routing (PER)    | Calls Peer to PStN        |

## Download and Run

Get the binary as [zip](https://github.com/fonoster/sipio/releases/download/1.0.0-M2/sipio.1.0.0-M2.zip) or [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M2/sipio.1.0.0-M2.tar.gz). Then from withing the root folder simply run:

```bash
./sipio
```

> You need Java 1.8 + to run Sip I/O. You will also need Gradle and Npm if you wish to [build from source](https://github.com/fonoster/sipio/wiki/Installing-and-Running-the-Server).

## Support

Please open an [issue](https://github.com/fonoster/sipio/issues) for support.

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/sipio/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/graphs/contributors)

## Authors
 - [Pedro Sanders](https://github.com/psanders)

## Copyright
Copyright (C) 2017 by [Fonoster Inc](https://github.com/fonoster). MIT License (see [LICENSE](https://github.com/fonoster/sipio/blob/master/LICENSE) for details).
