<div align="center">
  <p align="center">
    <a href="https://routr.io" target="_blank" rel="noopener">
      <img src="https://raw.githubusercontent.com/fonoster/routr/main/etc/assets/banner.png" />
    </a>
  </p>
</div>

<a href="https://gitpod.io/#https://github.com/fonoster/routr"> <img src="https://img.shields.io/badge/Contribute%20with-Gitpod-908a85?logo=gitpod" alt="Contribute with Gitpod" />
</a> [![Sponsor this](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/fonoster)](https://github.com/sponsors/fonoster) [![Discord](https://img.shields.io/discord/1016419835455996076?color=5865F2&label=Discord&logo=discord&logoColor=white)](https://discord.com/invite/4QWgSz4hTC) ![GitHub](https://img.shields.io/github/license/fonoster/routr?color=%2347b96d) ![Twitter Follow](https://img.shields.io/twitter/follow/fonoster?style=social)

Routr is a lightweight SIP proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators.

## Table of Contents

- [Features](#features)
- [Deployment](#deployment)
  - [Docker](#docker)
  - [Kubernetes](#kubernetes)
  - [Gitpod (Development)](#gitpod-development)
- [Getting Started with the CTL](#getting-started-with-the-ctl)
- [Getting Started with the Node SDK](#getting-started-with-the-node-sdk)
- [Building Custom Processors and Middleware](#building-custom-processors-and-middleware)
- [The Official Handbook](#the-official-handbook)
- [Testimonials](#testimonials)
- [Community](#community)
- [Bugs and Feedback](#bugs-and-feedback)
- [Contributing](#contributing)
- [Sponsors](#sponsors)
- [Authors](#authors)
- [License](#license)

## Features

- [x] Common SIP Server functions: Proxy, Registrar, Location Service
- [x] Programmable routing
- [x] Load balancing strategies against Media Servers like Asterisk and FreeSWITCH
- [x] Session Affinity
- [x] Multi-Tenant/Multi-Domain with domain-level Access Control Lists
- [x] Configurable routing strategies: Intra-Domain, Domain Ingress, Domain Egress, and Peer Egress
- [x] No single point of failure
- [x] Transport: TCP, UDP, TLS, WS, WSS
- [x] In-memory and Redis Location Service
- [x] JSON and YAML files as a data source
- [x] Postgres as a data source
- [x] Server management with the gRPC API
- [x] Node SDK
- [x] Command-Line Tool (CTL)
- [x] RTPEngine Middleware
- [x] Helm Chart for Kubernetes deployments
- [x] Endpoint authentication with JWT (for web phones)
- [ ] Region-based routing
- [ ] Support for STIR/SHAKEN
- [ ] Web Application

To learn more, read the [documentation](https://routr.io/docs).

## Deployment

### Docker

Create a `compose.yaml` file with the following content:

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

Start the server with Docker Compose:

```bash
# Replace with your host's IP address
DOCKER_HOST_ADDRESS=192.168.1.3 docker-compose up
```

Or run directly with Docker:

```bash
# Replace with your host's IP address
docker run \
  -p 51908:51908 \
  -p 5060:5060/udp \
  -e EXTERNAL_ADDRS=192.168.1.3 \
  fonoster/routr-one:latest
```

Wait a few seconds for the container to initialize, then verify it is running:

```bash
docker ps -a --format 'table {{.ID}}\t{{.Image}}\t{{.Status}}'
```

You should see output like this:

```
CONTAINER ID  IMAGE                         STATUS
6c63fd573768  fonoster/routr-one:latest      Up About a minute
```

If the status shows "Up," you are ready to go.

### Kubernetes

Routr can be installed in Kubernetes using Helm. These instructions assume you have a running Kubernetes cluster (you can use [Minikube](https://minikube.sigs.k8s.io/) or Docker Desktop for local development).

Add the Helm repository:

```bash
helm repo add routr https://routr.io/charts
helm repo update
```

Create a namespace and install Routr:

```bash
kubectl create namespace routr
helm install my-release routr/routr-connect --namespace routr
```

Wait a few minutes for the pods to start, then check their status:

```bash
kubectl get pods -n routr
```

All pods should show a status of `Running`. For more details, see the chart's [README](https://github.com/fonoster/routr/blob/main/ops/charts/connect/README.md).

### Gitpod (Development)

For a one-click development environment, open the project in Gitpod:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/fonoster/routr)

To connect to your Gitpod instance via SSH:

1. Add your public SSH key at [Gitpod account keys](https://gitpod.io/user/keys).
2. Open your [Gitpod workspaces](https://gitpod.io/workspaces), click "More" on your workspace, and select "Connect via SSH."
3. Copy the SSH command and run it in your terminal with port forwarding:

```bash
# Replace <workspace-ssh-connection> with your actual connection string
ssh -L 5060:localhost:5060 <workspace-ssh-connection>
```

For example:

```bash
ssh -L 5060:localhost:5060 fonoster-routr-mn8nsx0d9px@fonoster-routr-mn8nsx0d9px.ssh.ws-us90.gitpod.io
```

This forwards traffic from your local port 5060 to the Gitpod workspace, allowing you to reach the SIP server.

## Getting Started with the CTL

Regardless of the deployment method, you can manage your Routr server using the command-line tool.

Install it globally via npm:

```bash
npm install --location=global @routr/ctl
```

> If you don't have npm installed, follow the instructions at [nodejs.org](https://nodejs.org/en/download/).

Here is an example of creating a domain:

```bash
rctl domains create --insecure
```

> The `--insecure` flag is required when no TLS certificate has been configured for the API.

Follow the interactive prompts. The output will look like this:

```
This utility will help you create a new Domain.
Press ^C at any time to quit.
? Friendly Name Local Domain
? SIP URI sip.local
? IP Access Control List None
? Ready? Yes
Creating Domain Local Domain... a27e9fb2-a71a-4cf3-9b1d-dccf373f9777
```

For more examples, see the [CTL documentation](https://www.npmjs.com/package/@routr/ctl).

## Getting Started with the Node SDK

Make sure you have Node.js and npm installed, then create a new project:

```bash
mkdir my-project
cd my-project
npm init -y
npm install --save @routr/sdk
```

Create a file called `index.js`:

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
  .catch(console.error);
```

> The example above assumes that the ACL and Number already exist.

Run it:

```bash
node index.js
```

For complete documentation, visit the [@routr/sdk](https://www.npmjs.com/package/@routr/sdk) npm page.

## Building Custom Processors and Middleware

Routr is highly extensible. You can create custom Processors and Middleware to modify SIP messages as they pass through the server.

- **Processors** hold feature logic.
- **Middleware** addresses cross-cutting concerns like authentication, authorization, and rate limiting.

Both share the same interface. Here is a minimal Processor that responds with `200 OK` to every request:

```javascript
const Processor = require("@routr/processor").default
const { MessageRequest, Response } = require("@routr/processor")

new Processor({ bindAddr: "0.0.0.0:51904", name: "echo" }).listen(
  (req: MessageRequest, res: Response) => {
    console.log("got new request: ")
    console.log(JSON.stringify(req, null, " "))
    res.sendOk()
  }
)
```

You can find the complete code in the [echo module](https://github.com/fonoster/routr/tree/main/mods/echo).

For more examples, see:

- [Connect Processor](https://github.com/fonoster/routr/tree/main/mods/connect)
- [RTPRelay Middleware](https://github.com/fonoster/routr/tree/main/mods/rtprelay)
- [Simple Auth Middleware](https://github.com/fonoster/routr/tree/main/mods/simpleauth)
- [Processor Template](https://github.com/fonoster/nodejs-processor/tree/main)

For full details on building Processors and Middleware, see the [documentation](https://routr.io/docs).

## The Official Handbook

<a href="https://fonoster.gumroad.com/l/the-future-of-programmable-sip-servers">
<img src="https://raw.githubusercontent.com/psanders/psanders/master/book.png" width="300px"></a>

This handbook covers the architecture, features, and deployment of Routr in depth.

[Get the eBook &rarr;](https://fonoster.gumroad.com/l/the-future-of-programmable-sip-servers)

## Testimonials

> Routr's architecture and design is fantastic. A breath of fresh air. Being Docker and Kubernetes ready is a huge win over a more traditional SIP server setup.
>
> &mdash; [Phil Jones](https://www.linkedin.com/in/phil-jones-4346884a/), VP of Web Architecture at VQ Communications

> I came across Routr, which seems to be the one and only cloud-first Kubernetes-ready SIP server on the planet!
>
> &mdash; [Jessie Wadman](https://www.jessiewadman.se/), Cloud Architect at Camanio AB

> Awesome and one of the best open-source software in 2023.
>
> &mdash; [no-championship-s368](https://www.reddit.com/r/linux/comments/11xdvo5/routr_v2_the_future_of_programmable_sip_servers/), Reddit

> I think this project has a great promise to become a transformative technology.
>
> &mdash; [jbwill36](https://github.com/orgs/fonoster/discussions/209), GitHub

## Community

We are building Routr in the open. The best way to communicate with us is via [GitHub Discussions](https://github.com/fonoster/routr/discussions) or our [Discord server](https://discord.com/invite/4QWgSz4hTC).

<a href="https://cal.com/psanders"><img src="https://cal.com/book-with-cal-dark.svg" alt="Book us with Cal.com"></a>

## Bugs and Feedback

For bugs, questions, and discussions, please use [GitHub Issues](https://github.com/fonoster/routr/issues).

## Contributing

For contributing, please see the following links:

- [Contribution Guidelines](https://github.com/fonoster/routr/blob/master/CONTRIBUTING.md)
- [Contributors](https://github.com/fonoster/routr/contributors)

<!--contributors:start-->

<table>
<tr>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href=https://github.com/psanders>
            <img src=https://avatars.githubusercontent.com/u/539774?v=4 width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt=Pedro Sanders/>
            <br />
            <sub style="font-size:14px"><b>Pedro Sanders</b></sub>
        </a>
    </td>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href=https://github.com/efraa>
            <img src=https://avatars.githubusercontent.com/u/40646537?v=4 width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt=Efrain Peralta/>
            <br />
            <sub style="font-size:14px"><b>Efrain Peralta</b></sub>
        </a>
    </td>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href=https://github.com/vitalyster>
            <img src=https://avatars.githubusercontent.com/u/1052407?v=4 width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt=vitalyster/>
            <br />
            <sub style="font-size:14px"><b>vitalyster</b></sub>
        </a>
    </td>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href=https://github.com/Hannarong98>
            <img src=https://avatars.githubusercontent.com/u/42358864?v=4 width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt=Hannarong/>
            <br />
            <sub style="font-size:14px"><b>Hannarong</b></sub>
        </a>
    </td>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href=https://github.com/rafasc>
            <img src=https://avatars.githubusercontent.com/u/1923789?v=4 width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt=rafasc/>
            <br />
            <sub style="font-size:14px"><b>rafasc</b></sub>
        </a>
    </td>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href=https://github.com/kanimaru>
            <img src=https://avatars.githubusercontent.com/u/1733697?v=4 width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt=Kani/>
            <br />
            <sub style="font-size:14px"><b>Kani</b></sub>
        </a>
    </td>
</tr>
<tr>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href=https://github.com/SemiConscious>
            <img src=https://avatars.githubusercontent.com/u/1754942?v=4 width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt=SemiConscious/>
            <br />
            <sub style="font-size:14px"><b>SemiConscious</b></sub>
        </a>
    </td>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href=https://github.com/BROWT190>
            <img src=https://avatars.githubusercontent.com/u/141766680?v=4 width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt=Timmy/>
            <br />
            <sub style="font-size:14px"><b>Timmy</b></sub>
        </a>
    </td>
    <td align="center" style="word-wrap: break-word; width: 150.0; height: 150.0">
        <a href=https://github.com/luzpaz>
            <img src=https://avatars.githubusercontent.com/u/4140247?v=4 width="100;"  style="border-radius:50%;align-items:center;justify-content:center;overflow:hidden;padding-top:10px" alt=luzpaz/>
            <br />
            <sub style="font-size:14px"><b>luzpaz</b></sub>
        </a>
    </td>
</tr>
</table>

## Sponsors

We're glad to be supported by respected companies and individuals from several industries.

[Find all our supporters here](https://github.com/sponsors/fonoster) &middot; [Become a GitHub Sponsor](https://github.com/sponsors/fonoster)

## Authors

- [Pedro Sanders](https://github.com/psanders)

## License

Copyright (C) 2026 by [Fonoster Inc](https://fonoster.com). MIT License (see [LICENSE](https://github.com/fonoster/routr/blob/main/LICENSE) for details).

---

If you find Routr useful, please consider giving it a star on GitHub. It helps others discover the project.
