
<img src="https://raw.githubusercontent.com/fonoster/routr/master/docs/assets/brand.png" alt="Routr Logo" height="100">

<hr/>

[![Build Status](https://github.com/fonoster/routr/workflows/build/badge.svg)](https://github.com/fonoster/routr/actions?workflow=build) [![Maintainability](https://api.codeclimate.com/v1/badges/49ea061777d76c003b71/maintainability)](https://codeclimate.com/github/fonoster/routr/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/49ea061777d76c003b71/test_coverage)](https://codeclimate.com/github/fonoster/routr/test_coverage)
[![Join the chat Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/fonoster/routr?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Join the chat on Slack](https://img.shields.io/badge/slack-join%20chat-pink.svg)](https://fonosterteam.typeform.com/to/Xy8Oc0)
<a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license: MIT"></a>

* [About](#about)
* [Community](#community)
* [Deployment](#deployment)
    * [Snaps](#instant-server-installation-with-snaps)
    * [DigitalOcean droplet](#digitalocean-droplet)
    * [Docker](#docker)  
    * [Kubernetes](#kubernetes)  
    * [Google Cloud Shell](#google-cloud-shell)
    * [Custom](#custom)     
* [Features](#features)
* [Documentation](https://routr.io/docs/introduction/overview)
* [Demo](https://demo.routr.io/login)
* [Bugs and Feedback](#bugs-and-feedback)
* [Contributing](#contributing)
* [License](#license)

# About

Routr – a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators. It also provides with capabilities that are suitable for the enterprise and personal needs. To get involved in the development of this project please contact us at @fonoster.

[![Tweet](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?text=Next-generation%20SIP%20Server&url=https://github.com/fonoster/routr&via=fonoster&hashtags=voip,sip,webrtc,telephony)

# Community

Routr is developed in the open. Here are some of the channels we use to communicate and contribute:

**IRC**: `#routr` on [irc.freenode.net](https://freenode.net/) (for the easiest start, join via [Riot](https://riot.im/app/#/room/#routr:matrix.org))

(The IRC channel connects our [Gitter](https://gitter.im/fonoster/routr) and [Slack](https://fonosterteam.typeform.com/to/Xy8Oc0) communities)

**User mailing lists:**

- [routr-announce](https://groups.google.com/forum/#!forum/routr-announce) – for announcements like new releases
- [routr-users](https://groups.google.com/forum/#!forum/routr-users) – for discussions around Routr usage and community support

**Twitter:** [@Fonoster](https://twitter.com/fonoster)

**Issue tracker:** Use the GitHub issue tracker for the various [Routr repositories](https://github.com/fonoster/) to file bugs and features request. If you need support, please send your questions to the routr-users mailing list rather than filing a GitHub issue.

>Please do not ask individual project members for support. Use the channels above instead, where the whole community can help you and benefit from the solutions provided. If community support is insufficient for your situation, please contact us for Commercial Support.

# Deployment

## Instant Server Installation with Snaps

Install Routr in seconds on Linux (Ubuntu and others) with:

```bash
sudo snap install routr-server
```

[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/routr-server)

Routr Snap is recommended for Linux deployments

Installing snaps is very quick. By running that command you have your full Routr server up and running. Snaps are secure. They are isolated with all of their dependencies. Snaps also auto-update when we release new versions.

## DigitalOcean droplet

Build and Deploy to a DigitalOcean droplet

[![do-btn-blue](https://user-images.githubusercontent.com/51996/58146107-50512580-7c1a-11e9-8ec9-e032ba387c2a.png)](https://github.com/fonoster/routr/tree/master/.digitalocean/README.md)

## Docker
[Deploy with docker compose](https://routr.io/docs/guides/running-with-docker-or-compose/)

[![Docker logo](https://d207aa93qlcgug.cloudfront.net/1.95.5.qa/img/nav/docker-logo-loggedout.png)](https://hub.docker.com/r/fonoster/routr/)

OR Use the automated build image of our [most recent release](https://hub.docker.com/r/fonoster/routr/)

```
docker pull fonoster/routr:latest
```

OR select a specific release ([details of releases available](https://github.com/fonoster/routr/releases)):
```
docker pull fonoster/routr.chat:vX.X.X
```

## Kubernetes

Deploy to Kubernetes in [few easy steps](https://github.com/fonoster/routr/tree/master/.k8s/README.md)

## Google Cloud Shell

Routr one-click interactive tutorial will get you familiar with Routr server and the command-line interface.

[![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/fonoster/routr-walkthrough-tutorial&tutorial=tutorial.md)

## Custom

There are no special requirements to install and run the server. Just follow this easy steps:

&#10122; Download the server for your platform

| Platform | Download |
| -- | -- |
| Linux | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc3/routr-1.0.0-rc3_linux-x64_bin.tar.gz) |  
| macOS | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc3/routr-1.0.0-rc3_osx-x64_bin.tar.gz) |  
| Windows | [tar.gz](https://github.com/fonoster/routr/releases/download/1.0.0-rc3/routr-1.0.0-rc3_windows-x64_bin.tar.gz), [zip](https://github.com/fonoster/routr/releases/download/1.0.0-rc3/routr-1.0.0-rc3_windows-x64_bin.zip) |  

&#10123; Then extract it:

```bash
tar xvfz routr-*.tar.gz
cd routr-*
```

&#10124; Run the server using the `routr` command

```bash
./routr
```

# Features

Routr's main features are:

- Typical SIP Server functions; Proxy, Registrar, Location Service
- Multi-Tenant/Multi-Domain with Domain level Access Control List
- Transport: TCP, UDP, TLS, WebSocket
- Currently supports Redis and YAML files as the data source
- Server management and monitoring with the RESTful API, CLI, and Web Console
- Configurable routing strategies; Intra-Domain, Domain Ingress, Domain Egress and Peer Egress

To learn more, read the [documentation](https://routr.io/docs/introduction/overview/). :books:


# Bugs and Feedback

For bugs, questions, and discussions please use the [Github Issues](https://github.com/fonoster/routr/issues)

# Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/routr/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/routr/contributors)

# Authors
 - [Pedro Sanders](https://github.com/psanders)

# LICENSE
Copyright (C) 2019 by [Fonoster Inc](https://fonoster.com). MIT License (see [LICENSE](https://github.com/fonoster/routr/blob/master/LICENSE) for details).
