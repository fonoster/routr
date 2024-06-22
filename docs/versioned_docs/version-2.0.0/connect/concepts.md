# Concepts

The Connect Mode is Routr's implementation of the SIPConnect standard. Routr introduces the Connect Processor and five routing types as part of the implementation.

The Connect Mode introduces the Connect Processor, a built-in Processor with the necessary logic to implement the "SIP Connect v1.1" specification.

The following routing types are supported:

## Agent-to-Agent

The `agent-to-agent` routing type allows an Agent to call another Agent in the same Domain. The following yaml configuration shows a simple setup involving one Domain and two Agents:

**Domain configuration**

```yaml
- apiVersion: v2beta1
  kind: Domain
  ref: domain-01
  metadata:
    name: Local Domain
  spec:
    context:
      domainUri: sip.local
```

**Agents configuration**

```yaml
- apiVersion: v2beta1
  kind: Agent
  ref: agent-01
  metadata:
    name: John Doe
  spec:
    username: "1001"
    domainRef: domain-01
    credentialsRef: credentials-01

- apiVersion: v2beta1
  kind: Agent
  ref: agent-02
  metadata:
    name: Jane Doe
  spec:
    username: "1002"
    domainRef: domain-01
    credentialsRef: credentials-02
```

With the configuration above, John and Jane can call each other using their usernames.

> Here, we are showing the yaml representation of the resources for illustration purposes. However, we typically use the CTL or the SDK to create resources.

## Agent-to-PSTN

In the Connect Mode, the `agent-to-pstn` routing type allows an Agent to call numbers in the Private Switch Telephone Network (PSTN) using a Number and Trunking.

The `egressPolicies` section of the Domain resource handles the routing. The examples below show how these resources relate to each other.

**Domain configuration**

```yaml
- apiVersion: v2beta1
  kind: Domain
  ref: domain-01
  metadata:
    name: Local Domain
  spec:
    accessControlListRef: acl-01
    context:
      domainUri: sip.local
      egressPolicies:
        - rule: ".*"
          numberRef: number-01
```

**Number configuration**

```yaml
- apiVersion: v2beta1
  kind: Number
  ref: number-01
  metadata:
    name: "(910)343-4434"
    geoInfo:
      city: Durham, NC
      country: USA
      countryISOCode: US
  spec:
    trunkRef: trunk-01
    location:
      telUrl: tel:+19103434434
```

With the previous configuration, any Agent in the Domain can call the PSTN using the Number `(910)343-4434`.

## From-PSTN

The `from-pstn` routing type outlines how a call from the PSTN connects to an Agent or a Peer using a Number and Trunking. The `location` section of the Number resource manages this routing. For instance, to route calls from the PSTN to an Agent, you can use the following configuration:

```yaml
- apiVersion: v2beta1
  kind: Number
  ref: number-01
  metadata:
    name: "(910)343-4434"
    geoInfo:
      city: Durham, NC
      country: USA
      countryISOCode: US
  spec:
    trunkRef: trunk-01
    location:
      telUrl: tel:+19103434434
      aorLink: sip:john@sip.local
```

You can apply the same configuration to route calls from the PSTN to a Peer. For instance, to direct calls from the PSTN to an Asterisk server, you can adopt this configuration, provided the endpoint is registered with Routr.

## Peer-to-PSTN

The `peer-to-pstn` routing type describes how a Peer such as Asterisk can reach the PSTN. Unlike `agent-to-pstn`, this routing is not bound to a Domain. Because Peers are trusted entities, they can call the PSTN using the `Trunking` resource. This routing type is automatically selected when the number dialed by the Peer is not in the location table.

## Agent-to-Peer

This routing type allows any Agent to call a Peer. Because the Agent is going "outside" of the Domain's boundaries, the Agent must have a valid JWT token in the `X-Connect-Token` header. Incidentally, required claims in the JWT token include fields similar to the `Agent` resource. Here is an example of the payload of a JWT token:

```json
{
  "ref": "agent-01",
  "domainRef": "domain-01",
  "aor": "sip:1001@sip.local",
  "aorLink": "sip:asterisk@default",
  "domain": "sip.local",
  "privacy": "NONE",
  "allowedMethods": ["INVITE", "REGISTER"]
}
```
