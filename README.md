<div align="center">
  <p align="center">
    <a href="https://turnly.app" target="_blank" rel="noopener">
      <img src="https://raw.githubusercontent.com/fonoster/routr/main/banner.png" />
    </a>
  </p>
</div>

<a href="https://gitpod.io/#https://github.com/fonoster/routr"> <img src="https://img.shields.io/badge/Contribute%20with-Gitpod-908a85?logo=gitpod" alt="Contribute with Gitpod" />
</a> [![Sponsor this](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/fonoster)](https://github.com/sponsors/fonoster) [![Discord](https://img.shields.io/discord/1016419835455996076?color=5865F2&label=Discord&logo=discord&logoColor=white)](https://discord.gg/4QWgSz4hTC) ![GitHub](https://img.shields.io/github/license/fonoster/fonoster?color=%2347b96d) ![Twitter Follow](https://img.shields.io/twitter/follow/fonoster?style=social)

Routr is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators.

## Table of Content

* [Community](#community)
* [Features](#features)
* [The official handbook](#the-official-handbook)
* [Deployment](#deployment)
    * [Docker](#instant-server-deployment-with-docker-and-compose)
    * [Kubernetes](#kubernetes)  
    * [Gitpod](#deploying-in-development-mode-with-gitpod)
* [Example Configuration](#example-configuration)
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
- [x] Programmable routing
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

To learn more, read the [documentation](https://routr.io/docs/introduction/overview) :books:

## The official handbook

<a href="https://fonoster.gumroad.com/l/the-future-of-programmable-sip-servers">
<img src="https://raw.githubusercontent.com/psanders/psanders/master/book.png" width="300px"></a>

This handbook offers a detailed information about of the innovative features, challenges, and opportunities associated with using Routr.

Get the eBook.

* [Programmable, cloud-ready, open source](https://fonoster.gumroad.com/l/the-future-of-programmable-sip-servers)

## Give a Star! ⭐

If you want to support this project, please give it a star. Thanks 🙏

## Deployment

### Instant server deployment with Docker and Compose

First, create a directory named "routr". Navigate into the new folder, and then copy the content below:

Filename: _docker-compose.yml_

```yaml
version: "3"

services:
  routr:
    image: fonoster/routr-one:latest
    environment:
      EXTERNAL_ADDRS: ${DOCKER_HOST_ADDRESS}
    ports:
      - 51908:51908
      - 5060:5060/udp
    volumes:
      - shared:/var/lib/postgresql/data

volumes:
  shared:
```

Then, start the server with:

```bash
# Be sure to replace with your IP address
DOCKER_HOST_ADDRESS=192.168.1.3 docker-compose up
```

Wait a few seconds for the containers to initialize. Afterward, you can verify the status of the containers using:

```bash
docker ps -a --format 'table {{.ID}}\t{{.Image}}\t{{.Status}}'
```

You should see a container with the status "Up." It should look like the one below:

```bash
CONTAINER ID  IMAGE                                     STATUS
6c63fd573768  fonoster/routr-one:latest                 Up About a minute
```

If the status of your services is "Up," you are ready to go.

Finally, install the command-line tool and start building your SIP Network.

You can install the tool with npm as follows:

```bash
npm install --location=global @routr/ctl
```

And here is an example of creating a SIP Domain:

```bash
rctl domains create --insecure
```

> The --insecure flag is required as we did not set up the TLS settings.

For additional examples, refer to the command line [documentation.](https://www.npmjs.com/package/@routr/ctl)

### Kubernetes

Routr can be installed in Kubernetes using Helm. The following instructions assume that you have a Kubernetes cluster up and running. 

> You can use Minikube or Docker Desktop to create a local Kubernetes cluster.

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

You should see a list of pods and their status. If the status is Running, then you are ready to go.

For more details, please refer to the chart's [README](https://github.com/fonoster/routr/blob/main/ops/charts/connect/README.md).

### Deploying in development mode with Gitpod

Routr's one-click interactive deployment will familiarize you with the server in development mode.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/fonoster/routr)

To connect to your instance, follow these steps:

First, add your public SSH keys to your Gitpod account by going to [Gitpod account keys](https://gitpod.io/user/keys) and adding your public key.

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

## Example configuration

Consider a situation where you want to deploy the server and send all PSTN traffic to a conference room within Asterisk. For such a scenario, you must configure a Peer to present your feature server and a Number to route calls from the PSTN.

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

Notice that the loadBalancing section sets the `withSessionAffinity` to true. We need session affinity to ensure that all calls related to the conference arrive on the same Asterisk server. Every Asterisk server that registers with the asterisk username will join the `backend:conference` Address of Record (AOR).

Next, instruct Routr to map all inbound calls from a specific number to the conference room in Asterisk by setting the `aorLink` and `sessionAffinityHeader` parameters for the desired number. Here's an example:

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
