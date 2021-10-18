# Routr Server

Routr is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators.

Website: https://routr.io

## TL;DR;

```bash
$ helm repo add routr https://routr.io/charts
$ helm repo update
$ helm install routr routr/routr
```

**Note**: `routr` is your release name.

## Introduction

This chart bootstraps an [Routr Server](https://routr.io) deployment on a [Kubernetes](http://kubernetes.io/) cluster using the [Helm](https://helm.sh/) package manager.

## Prerequisites

- Kubernetes 1.16+
- Helm 3.0-beta3+
- PV provisioner support in the underlying infrastructure

## Add this Helm repository to your Helm client

```bash
helm repo add routr https://routr.io/charts
```

## Installing the Chart

To install the chart with the release name my-release:

```bash
$ kubectl create namespace routr
$ helm install my-release routr/routr --namespace routr
```

The command deploys Routr Server in the `default` namespace on the Kubernetes cluster in the default configuration.

We recommend using a namespace for easy upgrades.

The [configuration](https://hub.helm.sh/#configuration) section lists the parameters that can be configured during installation.

## Uninstalling the Chart

To uninstall/delete the `my-release` deployment:

```bash
$ helm uninstall my-release
```

The command removes all the Kubernetes components associated with the chart and eliminates the release.

## Changelog

The [CHANGELOG](https://github.com/fonoster/routr/tree/gh-pages/charts/CHANGELOG.md) provides notable changes on the chart.

## Parameters

The following table lists the configurable parameters of the Routr chart and their default values.

### Routr Services

| Parameter | Description | Default |
| --- | --- | --- |
| adminService.enabled | Enable or disable Service | `true` |
| adminService.type | Type of Service| `ClusterIP` |
| adminService.name | Service name | `<RELEASE>-api` |
| adminService.port | Service port | `4567` |
| adminService.externalIPs | Admin Service external IPs | `[]` |
| udpSignalingService.enabled | Enable disable or signaling UDP Service | `true` |
| udpSignalingService.type | Type for UDP signaling Service | `ClusterIP` |
| udpSignalingService.name | Name for UDP signaling Service | `<RELEASE>siptcp` |
| udpSignalingService.port | Port for UDP signaling Service | `5060` |
| udpSignalingService.externalTrafficPolicy | Route external traffic to node-local or cluster-wide endpoints | `Local` |
| udpSignalingService.externalIPs | UDP Signaling Service external IPs | `[]` |
| tcpSignalingService.enabled | Enable disable signaling Service | `true` |
| tcpSignalingService.type | Type for TCP signaling Service | `ClusterIP` |
| tcpSignalingService.name | Name for TCP signaling service | `<RELEASE>-siptcp` |
| tcpSignalingService.ports | Ports for TCP signaling Service | `[{name: siptcp, port: 5060}]` |
| tcpSignalingService.externalTrafficPolicy | Route external traffic to node-local or cluster-wide endpoints | `Local` |
| tcpSignalingService.externalIPs | TCP Signaling Service external IPs | `[]` |

### Routr parameters (optional)

| Parameter | Description | Default |
| --- | --- | --- |
| routr.userAgent| Sets sip header `User-Agent` to the desired value | `Routr v<VERSION>` |
| routr.bindAddr | Default stack IP address  | "" |
| routr.externAddr | IP address to advertise. Typically a LoadBalancer's public IP | "" |
| routr.localnets | Local networks in CIDR format. Use in combination with `externAddr` | [] |
| routr.recordRoute | Stay within the signaling path | `false` |
| routr.useToAsAOR | Uses the `To` header, instead of `Request-URI`, to locate endpoints | `false` |
| routr.patchRequestURI | Uses the user part of the `To` header to ammend the `Request-URI` if it doesn't have user| `false` |
| routr.registrarIntf | `Internal` causes the server to use the IP and port it "sees"(received & rport) from a device attempting to register | `External` |
| routr.accessControlList.deny | Deny incoming traffic from network list. Must be valid CIDR values | [] |
| routr.accessControlList.allow | Allow incoming traffic from network list. Must be valid CIDR values | [] |
| routr.restService.bindAddr | Restful service listening address | `0.0.0.0` |
| routr.restService.port | Restful service port | `4567` |
| routr.restService.minThreads | Minimum thread allocation | `8` |
| routr.restService.maxThreads | Maximum thread allocation | `200` |
| routr.restService.timeoutMillis | Will reject requests that last more than this value | `5000` |
| routr.restService.unsecured | Disabled https for restful calls. Not recommended in production | `false` |
| routr.restService.keyStore | Path to keyStore | `/opt/routr/etc/certs/api-cert.jks` |
| routr.restService.trueStore | Path to trueStore | `/opt/routr/etc/certs/api-cert.jks` |
| routr.restService.keyStorePassword | Password for keyStore | `changeit` |
| routr.restService.trueStorePassword | Password for trueStore | `changeit` |
| routr.securityContext.keyStore | Path to keyStore | `/opt/routr/etc/certs/domain-cert.jks` |
| routr.securityContext.trustStore | Path to trueStore | `/opt/routr/etc/certs/domain-cert.jks` |
| routr.securityContext.keyStorePassword | Password for keyStore | `changeit` |
| routr.securityContext.keyStoreType | KeyStore type | `jks` |
| routr.securityContext.client.authType | Type of client authentication. See https://goo.gl/1vKbXW for more options | `DisabledAll` |
| routr.securityContext.client.protocols.[*] | Accepted TLS protocols |`[TLSv1.2, TLSv1.1, TLSv1]` |
| routr.securityContext.debugging | Turns `ON` or `OFF` SSL debugging | `false` |
| routr.logLevel | Routr's logging level  | `info` |
| routr.ex_rtpEngine.enabled | If enabled, it will send all media thru the RTPEngine. | `false` |
| routr.ex_rtpEngine.proto | Reserved to allow for NG commands via `http`, `https`, and `udp`. Currently only `http` is supported | `http` |
| routr.ex_rtpEngine.host | Address for RTPEngine | "" |
| routr.ex_rtpEngine.port | Port for RTPEngine | `8080` |
| routr.ex_convertTelToE164 | If enabled, it will convert the number on ingress calls to `E164` format before routing the call | `false` |
| routr.ex_uniqueGatewayPerHostPort | If enabled, it will yield an error if a Gateway with the same host and port combination already exists | `false` |

> Variables prefixed with `ex_` are experimental features and may be removed or renamed in the future.

### Routr Images [advanced] (optional)

Routr Images are loaded from DockerHub by default. Images are public and by default latest images are downloaded. We recommend following this tag.

```
image:
  registry: docker.io # Docker Registry where to pull images from.
  repository: fonoster/routr # Routr docker repository.
  tag: latest # We recommend `latest` tag.
  pullPolicy: Always # We recommend Always
```  

### Redis Values

This is taken from Bitnami Helm Chart. Please refer to https://bitnami.com/stack/redis/helm

Here are default values:

```
redis:
  redisPort: 6379
  image:
    registry: docker.io
    repository: bitnami/redis
    tag: latest
    pullPolicy: Always
  usePassword: false
  cluster:
    enabled: false  
  persistence:
    enabled: true
    mountPath: /bitnami/redis
    size: 5Gi
```

## Specifying Values

Specify each parameter using the --set key=value[,key=value] argument to helm install. For example,

```bash
$ helm install --wait my-release \
  --set routr.logLevel=debug \
  routr/routr
```

Alternatively, you can provide a YAML file that specifies the above parameters' values while installing the chart. For example:

```bash
$ helm install --wait my-release -f values.yaml routr/routr
```
