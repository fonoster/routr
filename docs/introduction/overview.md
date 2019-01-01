## What is Routr?

[Routr](https://github.com/fonoster/routr) is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators. It also provides with capabilities that are suitable for the enterprise and personal needs. To get involved in the development of this project please contact us at [@fonoster](https://twitter.com/fonoster).

## Features

Routr's main features are:

- Typical Sip Server functions; Proxy, Registrar, Location Service
- Per node Multi-Tenancy/Multi-Domain with Domain level Access Control List
- Transport: TCP, UDP, TLS, WebSocket
- Routr currently support Redis, HTTP Requests, and YAML files as data source
- Server management and monitoring with the RESTful API, CLI, and Web Console
- Configurable routing strategies; Intra-Domain, Domain Ingress, Domain Egress and Peer Egress

## Components

The Routr ecosystem consists of three main components:

- The main [Routr server](https://github.com/fonoster/routr) server which acts as SIP server
- The command-line interface, [rctl](https://github.com/fonoster/routr-ctl), for remote management of the server
- A optional [web console](https://github.com/fonoster/routr-ui) for easy management of the server

## Architecture

This diagram illustrates the architecture of Routr and some of its ecosystem components:

<br/>
<img src="/assets/images/architecture.png" >
<br/>
<br/>

At the center of Routr are the routing rules. This rules are the core of Routr. In addition they are typical SIP Server the functions such as Proxy, Location, and Registrar. The main integration points are the data abstraction layer, the event publisher, and the RESTful API. This integration points, allow for easy integration with third party software.

## Use cases

Routr specializes in the management of SIP resources and a domain-centric routing strategies. It works well in front of the Media servers like Asterisk or FreeSWITCH. Routr runs in all mayor operating systems, in [Docker](https://www.docker.com/), and can be deployed as in cloud system such as [Kubernetes](https://kubernetes.io/).

Unlike Kamailio and OpenSIPS, Routr does not require of any type of scripting to perform any of its typical routing tasks. Routing is configure not programed. The monitoring tasks are centralized using a RESTful API, and from that API it is possible to control de service using command-line interface or the web UI.
