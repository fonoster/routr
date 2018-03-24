<h1 align="center">Sip I/O</h1> <br>
<p align="center">
  <a href="https://gitpoint.co/">
    <img alt="GitPoint" title="GitPoint" src="https://raw.githubusercontent.com/wiki/fonoster/sipio/images/logo.png" width="450">
  </a>
</p>

<p align="center">
  Next-generation Sip Server.
</p>

<p align="center">
  <a href="https://itunes.apple.com/us/app/gitpoint/id1251245162?mt=8">
    <img alt="Download on the App Store" title="App Store" src="http://i.imgur.com/0n2zqHD.png" width="140">
  </a>

  <a href="https://play.google.com/store/apps/details?id=com.gitpoint">
    <img alt="Get it on Google Play" title="Google Play" src="http://i.imgur.com/mtGRPuM.png" width="140">
  </a>
</p>

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Feedback](#feedback)
- [Contributors](#contributors)
- [Build Process](#build-process)
- [Backers](#backers-)
- [Sponsors](#sponsors-)
- [Acknowledgments](#acknowledgments)

# Introduction
# [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/fonoster/sipio/issues) [![Join the chat at https://gitter.im/sip-io/Lobby](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sip-io/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

**Sip I/O** is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators. It also provides with capabilities that are suitable for the enterprise and personal needs. For a list of features and documentation about the project please visit the [wiki](https://github.com/fonoster/sipio/wiki/Home). To get involved in the development of this project, please contact us at [@fonoster](https://twitter.com/fonoster).

## Configuration Overview

**Sip I/O**  API version is currently `v1draft1`. We will continue to improve the API, resource definition, and other artifacts until we reach a beta version. We will then establish an update policy to ensure backward compatibility. The configuration files are beautifully implemented using YAML(inspired by [Docker](https://www.docker.com/) and [Kubernetes](https://kubernetes.io/)) so this might be familiar to you. Here is an example of a `Domain` configuration:

```yml
- apiVersion: v1draft1
  kind: Domain
  metadata:
    name: Sip Local
  spec:
    context:
      domainUri: sip.local
      egressPolicy:
        rule: .*
        didRef: dd50baa4
      accessControlList:
        deny: [0.0.0.0/1]     # Deny all
        allow: [192.168.0.1/31]
```

## Running the Server

Install `Java 1.8 +`, get the binaries as [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M3/sipio.1.0.0-M3.tar.gz) or [zip](https://github.com/fonoster/sipio/releases/download/1.0.0-M3/sipio.1.0.0-M3.zip), and then from within the server's folder simply run:

```bash
./sipio
```

Alternatively, try using our experimental [docker image](https://github.com/fonoster/sipio/wiki/Running-on-Docker)

## Bugs and Feedback

For bugs, questions and discussions please use the [Github Issues](https://github.com/fonoster/sipio/issues)

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/sipio/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/graphs/contributors)

## Authors
 - [Pedro Sanders](https://github.com/psanders)

## LICENSE
Copyright (C) 2018 by [Fonoster Inc](https://github.com/fonoster). MIT License (see [LICENSE](https://github.com/fonoster/sipio/blob/master/LICENSE) for details).
