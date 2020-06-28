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

- Kubernetes 1.12+
- Helm 2.11+ or Helm 3.0-beta3+
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

## Update Strategies

Coming Soon.

## Uninstalling the Chart

To uninstall/delete the `my-release` deployment:

```bash
$ helm uninstall my-release
```

The command removes all the Kubernetes components associated with the chart and eliminates the release.

## Changelog

The [CHANGELOG](https://github.com/fonoster/routr/tree/gh-pages/charts/CHANGELOG.md) provides notable changes on the chart.

## Configuration

The following table lists the configurable parameters of the Routr chart and their default values.

| Parameter | Description | Default |
| --- | --- | --- |
| routr.image.repository | Docker image for Routr | `fonoster/routr`|
| routr.image.tag | Docker image tag | "" |
| routr.image.pullPolicy | Pull policy for the image | `Always` |
| routr.adminService.enabled | Enable or disable Service | `true` |
| routr.adminService.type | Type of Service| `ClusterIP` |
| routr.adminService.name | Service name | `<DEPLOYMENT NAME>-api` |
| routr.adminService.port | Service port | `4567` |
| routr.udpSignalingService.enabled | Enable disable or signaling UDP Service | `true` |
| routr.udpSignalingService.type | Type for UDP signaling Service | `ClusterIP` |
| routr.udpSignalingService.name | Name for UDP signaling Service | `<DEPLOYMENT NAME>-udp-signaling` |
| routr.udpSignalingService.port | Port for UDP signaling Service | `5060` |
| routr.udpSignalingService.externalTrafficPolicy | Route external traffic to node-local or cluster-wide endpoints | `Local` |
| routr.tcpSignalingService.enabled | Enable disable signaling Service | `true` |
| routr.tcpSignalingService.type | Type for TCP signaling Service | `ClusterIP` |
| routr.tcpSignalingService.name | Name for TCP signaling service | `<DEPLOYMENT NAME>-tcp-signaling` |
| routr.tcpSignalingService.ports | Ports for TCP signaling Service | `[{name: siptcp, port: 5060}]` |
| routr.tcpSignalingService.externalTrafficPolicy | Route external traffic to node-local or cluster-wide endpoints | `Local` |
| routr.userAgent| Sets sip header `User-Agent` to the desired value | `Routr v<VERSION>` |
| routr.bindAddr | Default stack IP address  | "" |
| routr.externAddr | IP address to advertise. Typically a LoadBalancer's public IP | "" |
| routr.localnets | Local networks in CIDR format. Use in combination with `routr.externAddr` | [] |
| routr.recordRoute | Stay within the signaling path | `false` |
| routr.useToAsAOR | Uses the `To` header, instead of `Request-URI`, to locate endpoints | `false` |
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

## Persistence

Coming Soon.

## TLS Certificates

Coming Soon.

## Security

Coming Soon.

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
