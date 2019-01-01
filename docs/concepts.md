The following are some key concepts including some of the most important routing strategies implemented in Routr.

## Intra-Domain Routing

_Intra-Domain Routing(IDR)_ offers a mechanism for user segmentation. For a small or medium size company a single domain may be sufficient, but for a multinational or an IP telephony service provider, it may not.

For a small company with less than 50 users, you may define a domain `sip.domain.com`. Regardless of how many offices they have, chances are that they still need to communicate with each other, and therefore we keep them in the same domain. Needless to say, that in a company this size you are not going to run out usernames.

A multinational company like _Walmart_ have thousands of stores that operate independently. In such a case, you will need a multi-domain setting. For example, you may define the domains `sip.0001.walmart.com` and `sip.0002.walmart.com`, and... you get the idea.

### Double Agents

<img src="https://raw.githubusercontent.com/wiki/fonoster/routr/images/double_agent.png" width=400 style="margin-bottom: 50px">
<br>

Yes, you can have double Agents, or Agents that exist in a multi-domain setup. All you need to do is include the domain in the Agent's `spec.domain[*]` list. In the example before, john can send or receive calls from both domains, while the rest of the Agents are only allowed to call within the domain.

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

And voila! That's all the configuration you need for intra-domain communication. For calls outside the domain, see "Domain Egress Routing" section and to receive calls from the PSTN check section "Domain Ingress Routing"

> To configure your sip devices use information found in `config/agents.yml`. Also, you must use the Host/IP of Routr server as
> the OUTBOUND PROXY of your sip device.

**Routing Rules**

The following rules apply to Intra-Domain Routing:

- Agents can only call other Agents in the same Domain
- Agents must belong to a Domain
- Agents Are not allowed to send a Digest username different than the username in the `From-Header`

## Domain Ingress Routing

The process of receiving a call from PSTN to a domain is known in **Routr** as _Domain Ingress Routing(DIR)_ and it is done using Gateway. Gateways are defined in the yaml file `config/gateways.yml`. The following example shows a typical Gateway configuration.

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
      registries: [sip.nyc.provider.net]     # These are additional registrars within the provider's network
```

You also need to define DIDs. Incoming calls from a DID will be routed to an existing Agent or Peer using the Address Of Record(AOR). The AOR must be available in the location service at the time of the call or the call will be rejected.

Please examine the following example:

```yaml
- apiVersion: v1beta1
  kind: DID
  metadata:
    gwRef: dd50baa4
    geoInfo:
      city: Columbus, GA
      country: USA
      countryISOCode: US
  spec:
    location:
      telUri: 'tel:17066041487'
      aorLink: 'sip:john@sip.local'      # This is the sip uri of an agent that is expected to be logged in
```

Easy right? Any incoming call from this Gateway and DID will be routed to "Jhon Doe" @ Ocean New York.

**Routing Rules**

As mention before, the path of an inbound PSTN call is determined by the `spec.location` block of a `DID` resource.
The `aorLink` refers to an Address of Record(Agent or Peer) that is available in the `location service`.

## Domain Egress Routing

_Domain Egress Routing(DER)_ is the way that **Routr** deals with a call request to a _callee_ that exists in the Public Switched Telephone Network(PSTN) and not in the _callers'_ domain. The Egress Policy consists of a `rule` and a `didRef`, and it is defined in the `spec.context` section of `Domains` resources.

The `rule` and `didRef` are defined as follows:

* `rule` is a regex to match callee in the call request. The location service will resort to this only after a search in the caller's Domain first.

* `didRef` is the identifier of the DID that will to route the call. This DID must already exist and have a parent Gateway.

**Routing Rules**

Agents can only perform outbound calls using the `Egress Policy` of their own Domains.

## Peers Routing

Peers are very similar to Agents but they are not bound to any Domain, and they are usually collocated in the same network with Routr. A common case will be peering with Asterisk, where Asterisk acts as a Media Server and Routr is used for signaling.

Peers can perform inbound/outbound signaling within the network without any special consideration since they exist inside the _Location Service_ just like Agents. So it is possible to perform signaling from Peer to Peer, Peer to Agent.

The same is true for Inbound from the PSTN. For example, we can redirect incoming calls from the PSTN using the `spec.location` settings in the `dids.yml` configuration file.

**Routing Rules**

Agents are not allowed to call Peers.

> A future version of the `Peer resource` will feature a `spec.acceptFrom.*` field to allow calls from Domains or specific Agents.
