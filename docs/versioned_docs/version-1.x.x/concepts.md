---
sidebar_position: 2
---

# Concepts

The following are some key concepts, including some of the essential routing strategies implemented in Routr.

## Intra-Domain Routing

_Intra-Domain Routing(IDR)_ offers a mechanism for user segmentation. For a small or medium size company, a single domain may be sufficient, but for a multinational or an IP telephony service provider, it may not.

For a small company with less than 50 users, you may define a domain `sip.domain.com`. Regardless of how many offices they have, the chances are that they still need to communicate with each other, and therefore we keep them in the same Domain. Needless to say, that in a company this size you are not going to run out usernames.

A multinational company like _Walmart_ have thousands of stores that operate independently. In such a case, you need a multi-domain setting. For example, you may define the domains `sip.0001.walmart.com` and `sip.0002.walmart.com`, and... you get the idea.

### Double Agents

<img src="https://raw.githubusercontent.com/wiki/fonoster/routr/images/double_agent.png" width="400" />

<br />
<br />

Yes, you can have double Agents, or Agents that exist in a multi-domain setup. For this to work, you need to do is include the Domain in the Agent's `spec.domain[*]` list. In the example before, John can send or receive calls from both domains, while the rest of the Agents are only allowed to call within the Domain.

### Single Domain Example

The following yaml configuration shows a simple setup, involving one Domain and two Agents:

**Domain configuration**

```yaml
- apiVersion: v1beta1
  kind: Domain
  metadata:
    name: Local Office
  spec:
    context:
      domainUri: sip.local
```

**Agents configuration**

```yaml
- apiVersion: v1beta1
  kind: Agent
  metadata:
    name: John Doe
  spec:
    credentials:
      username: john
      secret: '1234'
    domains: [sip.local]
- kind: Agent
  apiVersion: v1beta1
  metadata:
    name: Janie Doe
  spec:
    credentials:
      username: janie
      secret: '1234'
    domains: [sip.local]
```

 Voila! That's all the configuration you need for intra-domain communication. For calls outside the Domain, see "Domain Egress Routing" section and to receive calls from the PSTN check section "Domain Ingress Routing."

> To configure your sip devices use the information found in `config/agents.yml`. Also, you must use the Host/IP of Routr server as
> the OUTBOUND PROXY of your sip device.

**Routing Rules**

The following rules apply to Intra-Domain Routing:

- Agents can only call other Agents in the same Domain
- Agents must belong to a Domain
- Agents Are not allowed to send a Digest username different than the username in the `From-Header`

## Domain Ingress Routing

In Routr, the process of receiving a call from PSTN to a Domain is as _Domain Ingress Routing(DIR)_ and it is done using a Gateway resource. The yaml file `config/gateways.yml` contains the Gateways. The following example shows a typical Gateway configuration.

```yaml
- apiVersion: v1beta1
  kind: Gateway
  metadata:
    name: Plain Old Phone Service Provider
  spec:
    regService:
      host: sip.provider.net
      credentials:
        username: 'gwuser'
        secret: gwsecret
      transport: udp
      registries: [sip.nyc.provider.net] # These are additional registrars within the provider's network
```

You also need to define Numbers. Routr uses the Address Of Record(AOR) to routes incoming calls from a Number  to an existing Agent or Peer. The AOR must be available in the location service at the time of the call, or the call gets rejected.

Please examine the following example:

```yaml
- apiVersion: v1beta1
  kind: Number
  metadata:
    gwRef: dd50baa4
    geoInfo:
      city: Columbus, GA
      country: USA
      countryISOCode: US
  spec:
    location:
      telUrl: 'tel:17066041487'
      aorLink: 'sip:john@sip.local' # This is the sip uri of an agent that is expected to be logged in
```

Easy right? Any incoming call is routed from this Gateway and Number to "Jhon Doe" @ Ocean New York.

**Routing Rules**

The `spec.location` block of a `Number` resource configuration, determines the path of an inbound call from the PSTN. The `aorLink` refers to an Address of Record(Agent or Peer) that is available in the `location service`.

## Domain Egress Routing

_Domain Egress Routing(DER)_ is the way that **Routr** deals with a call request to a _callee_ that exists in the Public Switched Telephone Network(PSTN) and not in the _callers'_ Domain. The EgressPolicy consists of a `rule`, and a `numberRef` defined in the `spec.context` section of `Domains` resources.

The `rule` and `numberRef` is defined as follows:

* `rule` is a regex to match callee in the call request. The location service uses this only after a search in the caller's Domain first.

* `numberRef` is the identifier of the Number that will to route the call. The Number must already exist and have a parent Gateway.

**Routing Rules**

Agents can only perform outbound calls using the `Egress Policy` of their Domains.

## Peers Routing

Peers are very similar to Agents, but they are not bound to any Domain, and usually, collocated in the same network with Routr. A typical case is peering with Asterisk, where Asterisk acts as a Media Server and Routr provides the signaling.

Peers can perform inbound/outbound signaling within the network without any special consideration since they exist inside the _Location Service_ just like Agents. So it is possible to perform signaling from Peer to Peer, Peer to Agent.

The same is true for Inbound from the PSTN. For example, we can redirect incoming calls from the PSTN using the `spec.location` settings in the `numbers.yml` configuration file.

**Routing Rules**

Agents are not allowed to call Peers.

> A future version of the `Peer resource` might feature a `spec.acceptFrom.*` field to allow calls from Domains or specific Agents.
