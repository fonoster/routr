<a href="https://github.com/fonoster/sipio"><img src="https://raw.githubusercontent.com/wiki/fonoster/sipio/images/logo3.png"  width="200"></a>

* [Description](#description)
* [Key Concepts](#key-concepts)
* [Running the Server](#running-the-server)
* [Support](#support)
* [Contributing](#contribuiting)
* [Authors](#authors)
* [Copyright](#copyright)

## Description

**Sip I/O** is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators. For a list of features and documentation please visit the [wiki](https://github.com/fonoster/sipio/wiki). To get involved in the development of this project, please contact us at [@fonoster](https://twitter.com/fonoster).

**You can use it for:**

- [x] Simple call setup
- [x] WebRTC signaling
- [x] Signaling for chat applications
- [x] Frontend for Asterisk, FreeSWITCH, or any Media Server
- [ ] Presence
- [ ] Load balancing

## Key Concepts

This table includes some important concepts, including the different routing types implemented by the server.

| Concept | Description |
| -- | -- |
| Agent   | Agents represent SIP endpoints such as softphones and IP phones |
| Domain  | Enables the creation of isolated groups of Agents               |
| Peer    | Similar to Agents but without Domain boundaries                 |
| Gateway | SIP entity that allows call termination                         |
| DID     | Routes and translate calls between the PSTN and Sip I/O         |
| Intra-Domain Routing   | Routing type for calling within the same Domain  |
| Domain Ingress Routing | Calling from the PSTN to an Agent or Peer        |
| Domain Egress Routing  | Calling from an Agent to the PSTN thru a Gateway |
| Peer Egress Routing    | Similar to *DER* but applies only to Peers       |

## Running the Server

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
