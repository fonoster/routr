# Routr (v2)

<a href="https://gitpod.io/#https://github.com/fonoster/routr/tree/v2"> <img src="https://img.shields.io/badge/Contribute%20with-Gitpod-908a85?logo=gitpod" alt="Contribute with Gitpod" />
</a> [![Discord](https://img.shields.io/discord/1016419835455996076?color=5865F2&label=Discord&logo=discord&logoColor=white)](https://discord.gg/mpWSRUhG7e) <a href="https://github.com/fonoster/fonoster/blob/main/CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Code%20of%20Conduct-v1.0-ff69b4.svg?color=%2347b96d" alt="Code Of Conduct"></a> ![GitHub](https://img.shields.io/github/license/fonoster/fonoster?color=%2347b96d) ![Twitter Follow](https://img.shields.io/twitter/follow/fonoster?style=social)

Routr is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators.

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

**Twitter:** [@fonoster](https://twitter.com/fonoster)

**Issue tracker:** Use the GitHub issue tracker for the various [Routr repositories](https://github.com/fonoster/) to file bugs and features request. If you need support, please send your questions to the routr-users mailing list rather than filing a GitHub issue.

> Please do not ask individual project members for support. Use the channels above instead, where the whole community can help you and benefit from the solutions provided. Please get in touch with us for Commercial Support if community support is insufficient for your situation.

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
- [ ] Postgres as a data source
- [x] Server management with the gRPC API
- [ ] Server management with CLI and WebApp
- [ ] NodeJS and WebSDK
- [ ] Endpoint Authentication with JWT (For web phones)
- [ ] RTPEngine Middleware
- [ ] Support for STIR/SHAKEN 
- [ ] Helm Chart for  Kubernetes Deployments

To learn more, read the [documentation](https://routr.io/docs). :books:

## Give a Star! ⭐

If you like this project or plan to use it in the future, please give it a star. Thanks 🙏

## Example configuration

Consider a situation where you want to deploy the server and send all PSTN traffic to a conference room in Asterisk. For such a scenario, you must combine the `Peer` and `Number` resources and the `Location` service.

First, you will start by creating a Peer configuration for your Asterisk server similar to the following one:

```yaml
apiVersion: v2draft1
kind: Peer
ref: peer-01
metadata:
  name: Asterisk (Media Server)
spec:
  aor: backend:conference
  username: asterisk
  credentialsRef: credentials-01
```

Every Asterik server that registers using the `crd6t67r1` credentials will be grouped under the `backend:conference` Address of Record (AOR). Next, we need to tell Routr to map all inbound calls from given number to the conference room in Asterik. For that, we use the `aorLink` and `sessionAffinityHeader` on the desired Number. Here is an example: 

```yaml
apiVersion: v2draft1
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
      - name: X-Room-Id
        value: jsa-shqm-iyo
```

Finally, we configure the Location service to load-balance the traffic based on the `least-sessions` algorithm.

> We need Session Affinity to ensure all calls for a given `X-Room-Id` go to the same Asterisk server.

```yaml
kind: Location
apiVersion: v2draft1
metadata:
  region: us-east1
spec:
  bindAddr: 0.0.0.0:51902
  cache:
    provider: memory
  backends:
    - ref: conference
      balancingAlgorithm: least-sessions
      withSessionAffinity: true
```

The last scenario is just one of the many possible scenarios you can accomplish with Routr (v2). Please spend some time getting familiar with the [configuration files](https://github.com/fonoster/routr/blob/v2/CONNECT.md).

## Deployment

### Instant Server deployment with Docker and Compose

For a quick demo of Routr follow the next two steps:

&#10122; Clone the repository and run the server

```
git clone https://github.com/fonoster/routr
docker-compose up 
```

&#10123; Connect to Routr using Zoiper or another softphone

In the `config/resources`, you will find the `domains.yaml` and `agents.yaml` files. Those files contain the configuration to run a simple local network with two SIP Agents (John and Jane).

### Deploying in development mode with Gitpod

Routr's one-click interactive deployment will familiarize you with the server in development mode.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/fonoster/routr/tree/v2)

### Kubernetes

Deploying Routr in Kubernetes is coming soon.

## Bugs and Feedback

For bugs, questions, and discussions, please use the [Github Issues](https://github.com/fonoster/routr/issues)

## Contributing

For contributing, please see the following links:

 - [Contribution Documents](https://github.com/fonoster/fonoster/blob/master/CONTRIBUTING.md)
 - [Contributors](https://github.com/fonoster/routr/contributors)

**Sponsors**

We're glad to be supported by respected companies and individuals from several industries.

<a href="https://github.com/sponsors/fonoster"><img src="https://www.camanio.com/en/wp-content/uploads/sites/11/2018/09/camanio-carerund-cclogga-transparent.png" height="50"/></a>

Find all our supporters [here](https://github.com/sponsors/fonoster)

> [Become a Github Sponsor](https://github.com/sponsors/fonoster)

## Authors

 - [Pedro Sanders](https://github.com/psanders)

## License

Copyright (C) 2022 by [Fonoster Inc](https://fonoster.com). MIT License (see [LICENSE](https://github.com/fonoster/fonoster/blob/master/LICENSE) for details).
