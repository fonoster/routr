# Sip I/O: Next-generation Sip Server &nbsp;[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/fonoster/sipio/issues) [![Join the chat at https://gitter.im/sip-io/Lobby](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sip-io/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

<a href="https://github.com/fonoster/sipio"><img src="https://raw.githubusercontent.com/wiki/fonoster/sipio/images/logo.png" align="left" hspace="10" vspace="5" width="80"></a>

**Sip I/O** is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators. It also provides with capabilities that are suitable for the enterprise and personal needs. For a list of features and documentation about the project please visit the [wiki](https://github.com/fonoster/sipio/wiki/Home). To get involve in the development of this project, please contact us at [@fonoster](https://twitter.com/fonoster).

## Resources

* [Features](https://github.com/fonoster/sipio/wiki)
* [Release Notes](https://github.com/fonoster/sipio/releases)
* [Security](https://github.com/fonoster/sipio/wiki/Securing-the-Signaling)
* [Basic Setup](https://github.com/fonoster/sipio/tree/master/config/samples/basic_setup)
* [Wiki](https://github.com/fonoster/sipio/wiki)

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
        didRef: DID0001
      accessControlList:
        deny: [0.0.0.0/1]     # Deny all
        allow: [192.168.0.1/31]
```

## Running the Server :up:

Install `Java 1.8 +`, get the binaries as [tar.gz](https://github.com/fonoster/sipio/releases/download/1.0.0-M2/sipio.1.0.0-M2.tar.gz) or [zip](https://github.com/fonoster/sipio/releases/download/1.0.0-M2/sipio.1.0.0-M2.zip), and then from within the server's folder simply run:

```bash
./sipio
```

## Bugs and Feedback

For bugs, questions and discussions please use the [Github Issues](https://github.com/fonoster/sipio/issues)

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/sipio/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/graphs/contributors)

## Authors
 - [Pedro Sanders](https://github.com/psanders)

## LICENSE
Copyright (C) 2017 by [Fonoster Inc](https://github.com/fonoster). MIT License (see [LICENSE](https://github.com/fonoster/sipio/blob/master/LICENSE) for details).
