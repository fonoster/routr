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

## Table of content

* [Community](#community)
* [Should you try Routr?](#should-you-try-routr)
* [Features](#features)
* [The official handbook](#the-official-handbook)
* [Deployment](#deployment)
    * [Docker](#instant-server-deployment-with-docker-and-compose)
    * [Kubernetes](#kubernetes)  
    * [Gitpod](#deploying-in-development-mode-with-gitpod)
* [Getting started with the CTL](#getting-started-with-the-ctl)
* [First steps with the NodeSDK](#first-steps-with-the-nodesdk)
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

## Should you try Routr?

> I came across Routr, which seems to be the one and only cloud-first Kubernetes-ready SIP server on the planet!
> 
> [Jessie Wadman](https://www.jessiewadman.se/), Cloud Architect @ Camanio AB

> Awesome and one of the best open-source software in 2023.
> 
> [no-championship-s368](https://www.reddit.com/r/linux/comments/11xdvo5/routr_v2_the_future_of_programmable_sip_servers/), Check conversation @ Reddit

> I think this project has a great promise to become a transformative technology.
> 
> [jbwill36](https://github.com/orgs/fonoster/discussions/209), Check conversation @ GitHub

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

## Give a star! ⭐

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

Alternatively, you can use the following command:

```bash
# Be sure to replace with your IP address
docker run --name routr \
  -p 51908:51908 \
  -p 5060:5060/udp \
  -e EXTERNAL_ADDRS=192.168.1.3 \
  fonoster/routr-one:latest
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
kubectl create namespace routr
```

Next, install Routr with the following command:

```bash
helm install my-release routr/routr-connect --namespace routr
```

Finally, wait a few minutes for the pods to start. You can check the status of the pods with the following command:

```bash
kubectl get pods -n routr
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

## Getting started with the CTL

Regadles of the deployment method, you can use the command-line tool to manage your server.

To install the command-line tool, run the following command:

```bash
npm install --location=global @routr/ctl
```

We are using the flag `--location=global` to tell npm to install the command-line tool globally. If you don't have npm installed, you can follow the instructions here: https://nodejs.org/en/download/.

Here is an example of how to create a domain:

```bash
rctl domains create --insecure
```

The `--insecure` flag, in the last example, is required because no certificate was provided to secure the API. 

Follow the prompts to create the domain.

The output should look like this:

```bash
This utility will help you create a new Domain.
Press ^C at any time to quit.
? Friendly Name Local Domain
? SIP URI sip.local
? IP Access Control List None
? Ready? Yes
Creating Domain Local Domain... a27e9fb2-a71a-4cf3-9b1d-dccf373f9777
```

For additional examples, refer to the command line [documentation.](https://www.npmjs.com/package/@routr/ctl)

## First steps with the NodeSDK

To begin using the Node.js SDK, first make sure you have Node and NPM installed. Then, start by creating a new project and installing the Routr Connect SDK.

```bash
mkdir my-project
cd my-project
npm init -y
```

Next, install the SDK:

```bash
npm install --save @routr/sdk
```

Now, create a new file called `index.js` and add the following code:

```javascript
const SDK = require("@routr/sdk");

const domains = new SDK.Domains();

const request = {
  name: "Local domain",
  domainUri: "sip.local",
  accessControlListRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3", 
  egressPolicies: [{
    rule: ".*",
    numberRef: "4671371b-ff5d-48b1-aabe-d3c5ca5317a3"
  }],
  extended: {
    "key": "value"
  } 
};

domains.createDomain(request) 
  .then(console.log)
  .catch(console.error); // an error occurred
```

> In the example above, we assume that the ACL and Number already exist.

Now, go ahead and run the code:

```bash
node index.js
```

For complete documentation, please visit the npm page for `@routr/sdk` at https://www.npmjs.com/package/@routr/sdk

## Bugs and feedback

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
