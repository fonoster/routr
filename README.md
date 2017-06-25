# Sip I/O: Next-generation Sip Server &nbsp;&nbsp; [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/fonoster/sipio/issues) [![Join the chat at https://gitter.im/sip-io/Lobby](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sip-io/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

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

## Key Concepts :books:

This following table features some important concepts, including the different routing types implemented by the server.

| Concept | Description |
| -- | -- |
| Agent   | Agents represent SIP endpoints such as softphones and IP phones |
| Domain  | Enables the creation of isolated groups of Agents               |
| Peer    | Similar to Agents but without Domain boundaries                 |
| Gateway | SIP entity that allows call termination                         |
| DID     | Routes and translate calls between the PSTN and Sip I/O         |
| Intra-Domain Routing  | Routing type for calling within the same Domain   |
| Domain Ingress Routing | Calling from the PSTN to an Agent or Peer        |
| Domain Egress Routing | Calling from an Agent to the PSTN thru a Gateway  |
| Peer Egress Routing | Similar to *DER* but applies only to Peers          |

## Running the Server :up:

Install `Java 1.8 +`, get the binaries as [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M2/sipio.1.0.0-M2.tar.gz) or [zip](https://github.com/fonoster/sipio/releases/download/1.0.0-M2/sipio.1.0.0-M2.zip), and then from within the server's folder simply run:

```bash
./sipio
```


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
