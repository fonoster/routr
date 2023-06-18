<div align="center">
  <p align="center">
    <a href="https://turnly.app" target="_blank" rel="noopener">
      <img src="https://raw.githubusercontent.com/fonoster/routr/main/banner.png" />
    </a>
  </p>
</div>

<a href="https://gitpod.io/#https://github.com/fonoster/routr"> <img src="https://img.shields.io/badge/Contribute%20with-Gitpod-908a85?logo=gitpod" alt="Contribute with Gitpod" />
</a> [![Sponsor this](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/fonoster)](https://github.com/sponsors/fonoster) [![Discord](https://img.shields.io/discord/1016419835455996076?color=5865F2&label=Discord&logo=discord&logoColor=white)](https://discord.gg/mpWSRUhG7e) ![GitHub](https://img.shields.io/github/license/fonoster/fonoster?color=%2347b96d) ![Twitter Follow](https://img.shields.io/twitter/follow/fonoster?style=social)

Routr is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators.

## Table of Content

* [Community](#community)
* [Features](#features)
* [Example Configuration](#example-configuration)
* [Deployment](#deployment)
    * [Docker](#instant-server-deployment-with-docker-and-compose)
    * [Kubernetes](#kubernetes)  
    * [Gitpod](#deploying-in-development-mode-with-gitpod)
* [Documentation](https://routr.io/docs/introduction/overview)
* [Sponsors](#sponsors)
* [Contributing](#contributing)
* [License](#license)

## Community

We are building Routr in the open. The best to communicate with us via [GitHub Discussions.](https://github.com/fonoster/fonoster/discussions)

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
  <sub>There we plan to discuss roadmaps, feature requests, and more<br><a href="https://discord.gg/mpWSRUhG7e">Join us today</a></sub>
</p>

---

## Features

Routr's main features are:

- [x] Common SIP Server functions; Proxy, Registrar, Location Service
- [x] Programmable Routing
- [x] Load balancing strategies against Media Servers like Asterisk and FreeSWITCH
- [x] Session Affinity 
- [x] Multi-Tenant/Multi-Domain with Domain level Access Control List
- [ ] Region-based routing
- [x] Configurable routing strategies; Intra-Domain, Domain Ingress, Domain Egress, and Peer Egress
- [x] No single point of failure
- [x] Transport: TCP, UDP, TLS, WS, WSS
- [x] In-memory and Redis Location Service 
- [x] JSON and YAML files as a data source
- [x] Postgres as a data source
- [x] Server management with the gRPC API
- [x] NodeSDK
- [x] Command-Line Tool
- [x] RTPEngine Middleware
- [x] Helm Chart for  Kubernetes Deployments
- [x] Endpoint Authentication with JWT (For web phones)
- [ ] Support for STIR/SHAKEN
- [ ] Web Application

To learn more, read the [documentation](https://routr.io/docs). :books:

## The official handbook

<a href="https://fonoster.gumroad.com/l/the-future-of-programmable-sip-servers">
<img src="https://raw.githubusercontent.com/psanders/psanders/master/book.png" width="300px"></a>

This handbook is designed to provide a detailed understanding of the innovative features, challenges, and opportunities that Routr presents in the realm of programmable SIP Servers.

Get the eBook.

* [Programmable, cloud ready, open source](https://fonoster.gumroad.com/l/the-future-of-programmable-sip-servers)

## Give a Star! ⭐

If you like this project or plan to use it in the future, please give it a star. Thanks 🙏

## Example configuration

Consider a situation where you want to deploy the server and send all PSTN traffic to a conference room in Asterisk. For such a scenario, you must configure a Peer to present your feature server and a Number to route calls from the PSTN.

First, start by creating a Peer configuration for your Asterisk server similar to the following one:

```yaml
apiVersion: v2beta1
kind: Peer
ref: peer-01
metadata:
  name: Asterisk (Media Server)
spec:
  aor: backend:conference
  username: asterisk
  credentialsRef: credentials-01
  loadBalancing:
    withSessionAffinity: true
    algorithm: least-sessions
```

Notice that the loadBalancing section sets the `withSessionAffinity` to true. We need session affinity to ensure that all calls related to the conference arrive on the same Asterisk server. Every Asterisk server that registers using the `asterisk` username will be grouped under the `backend:conference` Address of Record (AOR). 

Next, we need to tell Routr to map all inbound calls from a given Number to the conference room in Asterisk. For that, we use the `aorLink` and `sessionAffinityHeader` on the desired Number. Here is an example: 

```yaml
apiVersion: v2beta1
kind: Number
ref: number-01
metadata:
  name: "(706)604-1487"
  geoInfo:
    city: Columbus, GA
    country: USA
    countryISOCode: US
spec:
  trunkRef: trunk-01
  location:
    telUrl: tel:+17066041487
    aorLink: backend:conference
    sessionAffinityHeader: X-Room-Id
    extraHeaders:
      # Appends the X-Room-Id header to all inbound calls
      - name: X-Room-Id
        value: jsa-shqm-iyo
```

The last scenario is one of the many possible scenarios you can accomplish with Routr (v2). Please spend some time getting familiar with the [configuration files](https://github.com/fonoster/routr/blob/main/CONNECT.md).

## Deployment

### Instant Server deployment with Docker and Compose

For a quick demo of Routr, follow the next two steps:

1. Clone the repository and run the server

```
git clone https://github.com/fonoster/routr
docker-compose up 
```

2. Connect to Routr using Zoiper or another softphone

In the `config/resources`, you will find the `domains.yaml` and `agents.yaml` files. Those files contain the configuration to run a simple local network with two SIP Agents (John and Jane).

### Kubernetes

Routr can be installed in Kubernetes using Helm. The following instructions assume that you have a Kubernetes cluster up and running. If you don’t have one, you can use Minikube or Docker Desktop to create a local cluster.

First, add the Helm repository:

```bash
helm repo add routr https://routr.io/charts
helm repo update
```

Then, create a namespace for Routr:

```bash
kubectl create namespace sipnet
```

Next, install Routr with the following command:

```bash
helm install sipnet routr/routr-connect --namespace sipnet
```

Finally, wait a few minutes for the pods to start. You can check the status of the pods with the following command:

```bash
kubectl get pods -n sipnet
```

You should see a list of pods and their status. If you see the status Runnning, then you are ready to go.

For a more detailed explanation please refer to the chart's [readme](https://github.com/fonoster/routr/blob/main/ops/charts/connect/README.md).

### Deploying in development mode with Gitpod

Routr's one-click interactive deployment will familiarize you with the server in development mode.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/fonoster/routr)

To connect to your instance, follow these steps:

First, add your public SSH-keys to your Gitpod account by going to [Gitpod account keys](https://gitpod.io/user/keys) and adding your public key.

Next, find your [Gitpod workspace](https://gitpod.io/workspaces) and click on the "More" button. Then, select "Connect via SSH."

Finally, copy the SSH Command and run it in your terminal by pasting it and pressing Enter. The command should look like this:

```bash
ssh -L 5060:localhost:5060 <workspace-ssh-connection>
```

Replace <workspace-ssh-connection> with your own workspace SSH connection.

For example, your command might look like this:

```bash
ssh -L 5060:localhost:5060 fonoster-routr-mn8nsx0d9px@fonoster-routr-mn8nsx0d9px.ssh.ws-us90.gitpod.io
```

This command forwards traffic from your local port 5060 to your Gitpod workspace's port 5060, allowing you to access your instance.

## Bugs and Feedback

For bugs, questions, and discussions, please use the [Github Issues](https://github.com/fonoster/routr/issues)

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/fonoster/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/routr/contributors)

## Sponsors

We're glad to be supported by respected companies and individuals from several industries.

<a href="https://github.com/sponsors/fonoster"><img src="https://www.camanio.com/en/wp-content/uploads/sites/11/2018/09/camanio-carerund-cclogga-transparent.png" height="50"/></a>

Find all our supporters [here](https://github.com/sponsors/fonoster)

> [Become a Github Sponsor](https://github.com/sponsors/fonoster)

## Authors

 - [Pedro Sanders](https://github.com/psanders)

## License

Copyright (C) 2023 by [Fonoster Inc](https://fonoster.com). MIT License (see [LICENSE](https://github.com/fonoster/fonoster/blob/master/LICENSE) for details).
