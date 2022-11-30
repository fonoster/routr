
<p align="left">
  <a href="https://routr.io/">
    <img src="https://raw.githubusercontent.com/fonoster/routr/master/docs/assets/brand.png" alt="Routr Logo" height="80">
  </a>
</p>

## Table of Content

* [About](#about)
* [Community](#community)
* [Deployment](#deployment)
    * [Snaps](#instant-server-installation-with-snaps)
    * [Docker](#docker)  
    * [Kubernetes](#kubernetes)  
    * [Google Cloud Shell](#google-cloud-shell)
    * [Custom](#custom)     
* [Features](#features)
* [Documentation](https://routr.io/docs/introduction/overview)
* [Bugs and Feedback](#bugs-and-feedback)
* [Contributing](#contributing)
* [License](#license)

## About

[![Build Status](https://github.com/fonoster/routr/workflows/build/badge.svg)](https://github.com/fonoster/routr/actions?workflow=build) </a> [![Discord](https://img.shields.io/discord/1016419835455996076?color=5865F2&label=Discord&logo=discord&logoColor=white)](https://discord.gg/mpWSRUhG7e) <a href="https://github.com/fonoster/fonoster/blob/main/CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Code%20of%20Conduct-v1.0-ff69b4.svg?color=%2347b96d" alt="Code Of Conduct"></a> ![GitHub](https://img.shields.io/github/license/fonoster/fonoster?color=%2347b96d) ![Twitter Follow](https://img.shields.io/twitter/follow/fonoster?style=social)

Routr is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators.

## Community

Routr is developed in the open. The best to communicate with us via [GitHub Discussions.](https://github.com/fonoster/fonoster/discussions)

---

<p align="center">
	<sup>Special Announcement:</sup>
	<br>
	<a href="https://discord.gg/mpWSRUhG7e">
		<img width="70px" src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/625e5fcef7ab80b8c1fe559e_Discord-Logo-Color.png">
	</a>
	<br>
	<sub><b>We now have a Discord Channel</b></sub>
	<br>
	<sub>There we plan to discuss roadmaps, feature requests and more<br><a href="https://discord.gg/mpWSRUhG7e">Join us today</a></sub>
</p>

---

**Twitter:** [@fonoster](https://twitter.com/fonoster)

**Issue tracker:** Use the GitHub issue tracker for the various [Routr repositories](https://github.com/fonoster/) to file bugs and features request. If you need support, please send your questions to GitHub Discussions rather than filing a GitHub issue.

> Please do not ask individual project members for support. Use the channels above instead, where the whole community can help you and benefit from the solutions provided. If community support is insufficient for your situation, please contact us for Commercial Support.

## Deployment

### Instant Server Installation with Snaps

Install Routr in seconds on Linux (Ubuntu and others) with:

```bash
sudo snap install routr-server rctl
```

[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/routr-server)

For Linux deployments, Routr Snap is the recommended method of installation.

Installing snaps is very quick. By running that command, you have your full Routr server up and running. Snaps are secure. They are isolated, with everything they need to run. Snaps also auto-update when we release a new version.

### Docker

[Deploy with docker compose](https://routr.io/docs/guides/running-with-docker-or-compose/)

[![Docker logo](https://d207aa93qlcgug.cloudfront.net/1.95.5.qa/img/nav/docker-logo-loggedout.png)](https://hub.docker.com/r/fonoster/routr/)

Or use the automated build image of our [most recent release](https://hub.docker.com/r/fonoster/routr/)

```
docker pull fonoster/routr:latest
```

OR select a specific release ([details of releases available](https://github.com/fonoster/routr/releases)):
```
docker pull fonoster/routr:vX.X.X
```

### Kubernetes

Deploy to Kubernetes in [few easy steps](https://github.com/fonoster/routr/tree/master/.helm/README.md)

### Google Cloud Shell

Routr one-click interactive tutorial will get you familiar with Routr server and the command-line interface.

[![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/fonoster/routr-walkthrough-tutorial&tutorial=tutorial.md)

### Custom

There are no special requirements to install and run the server. Just follow these easy steps:

&#10122; Download the server for your platform

| Platform | Download |
| -- | -- |
| Linux | [tar.gz](https://github.com/fonoster/routr/releases/download/1.2.0/routr-1.2.0_linux-x64_bin.tar.gz) |  
| macOS | [tar.gz](https://github.com/fonoster/routr/releases/download/1.2.0/routr-1.2.0_osx-x64_bin.tar.gz) |  
| Windows | [tar.gz](https://github.com/fonoster/routr/releases/download/1.2.0/routr-1.2.0_windows-x64_bin.tar.gz), [zip](https://github.com/fonoster/routr/releases/download/1.2.0/routr-1.2.0_windows-x64_bin.zip) |  

&#10123; Then extract it:

```bash
tar xvfz routr-*.tar.gz
cd routr-*
```

&#10124; Run the server using the `routr` command

```bash
./routr
```

## Features

Routr's main features are:

- Typical SIP Server functions; Proxy, Registrar, Location Service
- Multi-Tenant/Multi-Domain with Domain level Access Control List
- Transport: TCP, UDP, TLS, WS, WSS
- Currently supports Redis and YAML files as the data source
- Server management and monitoring with the RESTful API, CLI, and Web Console
- Configurable routing strategies; Intra-Domain, Domain Ingress, Domain Egress and Peer Egress

To learn more, read the [documentation](https://routr.io/docs/introduction/overview/). :books:


## Bugs and Feedback

For bugs, questions, and discussions, please use the [Github Issues](https://github.com/fonoster/routr/issues)

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/routr/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/routr/contributors)

## Authors
 - [Pedro Sanders](https://github.com/psanders)

## License
Copyright (C) 2022 by [Fonoster Inc](https://fonoster.com). MIT License (see [LICENSE](https://github.com/fonoster/routr/blob/master/LICENSE) for details).
