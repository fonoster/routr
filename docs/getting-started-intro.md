---
id: getting-started-introduction
title: Introduction
custom_edit_url: https://github.com/fonoster/sipio/edit/master/docs/getting-started-introduction.md
---

**Sip I/O** is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators. It also provides with capabilities that are suitable for the enterprise and personal needs. To get involved in the development of this project please contact us at [@fonoster](https://twitter.com/fonoster).

## Features

- Proxy
- Registrar Service
- Location Service
- Call Forking
- Multi-Tenancy/Multi-Domain
- Access to the PSTN Using SIP Gateways
- Transport: TCP, UDP, TLS, WebSocket
- Data Sources: Redis, Restful API, Files
- Security
  - Digest SIP User Authentication
  - Domain Access Control List (DACL)
  - RESTful service secured with TLS and JWT tokens
- Rest API
- Command Line Tool for Admin Operations
- Routing Capabilities
  - Intra-Domain Routing (IDR)
  - Domain Ingress Routing(DIR)
  - Domain Egress Routing (DER)
  - Peer Egress Routing (PER)

## Key Concepts

This following table features some important concepts, including the different routing types implemented by the server.

| Concept | Description |
| -- | -- |
| User    | Users perform administrative actions on the server              |
| Agent   | Agents represent SIP endpoints such as softphones and IP phones |
| Domain  | Enables the creation of isolated groups of Agents               |
| Peer    | Similar to Agents but without Domain boundaries                 |
| Gateway | SIP entity that allows call termination                         |
| DID     | Routes and translate calls between the PSTN and Sip I/O         |
| Intra-Domain Routing  | Routing type for calling within the same Domain   |
| Domain Ingress Routing | Calling from the PSTN to an Agent or Peer        |
| Domain Egress Routing | Calling from an Agent to the PSTN thru a Gateway  |
| Peer Egress Routing | Similar to *DER* but applies only to Peers          |

## Typical Deployment
The following image depicts a typical SIP deployment with **Sip I/O**

<img src="https://raw.githubusercontent.com/wiki/fonoster/sipio/images/signal.png" hspace="10" vspace="5" style="margin-bottom: 50px">
