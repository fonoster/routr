# Routr Server

Routr is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators.

Website: https://routr.io

## TL;DR;

```bash
$ helm repo add routr https://routr.io/charts
$ helm repo update
$ helm install routr routr/routr-server
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
$ helm install my-release routr/routr-server -n routr
```

The command deploys Routr Server in the `default` namespace on the Kubernetes cluster in the default configuration.

It is recommended to use the a namespace for easy upgrades.

The [configuration](https://hub.helm.sh/#configuration) section lists the parameters that can be configured during installation.

## Update Strategies

Coming Soon...

## Uninstalling the Chart

To uninstall/delete the `my-release` deployment:

```bash
$ helm uninstall my-release
```

The command removes all the Kubernetes components associated with the chart and deletes the release.

## Changelog

Notable chart changes are listed in the [CHANGELOG](https://github.com/fonoster/routr/tree/gh-pages/charts/CHANGELOG.md)

## Routr Configuration

The following tables lists the configurable parameters of the Routr chart and their default values.

| Parameter | Description | Default |
| --- | --- | --- |
| routr.image.repository | Docker image for Routr | `fonoster/routr`|
| routr.image.tag | Docker image tag | "" |
| routr.image.pullPolicy | Pull policy for the image | `Always` |
| routr.adminService.enabled | Enable or disable admin service | `true` |
| routr.adminService.type | Admin service type | `ClusterIP` |
| routr.adminService.port | Admin service port | `4567` |
| routr.signalingService.enabled | Enable disable signaling service | `true` |
| routr.signalingService.type | Signaling service type | `ClusterIP` | 
| routr.signalingService.externalTrafficPolicy | | `Local` |
| routr.userAgent| Sets sip header `User-Agent` to the desired value | `Routr v<VERSION>` |
| routr.dataSource.provider | Defines data provider | `redis_data_provider` |
| routr.dataSource.parameters | Data Source Parameters | `host=routr-redis-master-0,port=6379` |
| routr.bindAddr | Default stack IP address  | "" |
| routr.externAddr | IP address to advertise. Typically a LoadBalancer's public IP | "" |
| routr.localnets | Local networks. Use in combination with `routr.externAddr` | "" |
| routr.recordRoute | Stay within the signaling path | `false` |
| routr.useToAsAOR | Uses the header `To`, instead of `Request-URI`, to locate endopoints | `false` |
| routr.registrarIntf | `Internal` causes the server to use the IP and port it "sees"(received & rport) from a device attempting to register | `External` |
| routr.accessControlList.deny.[*] | Deny incoming traffic from network list | `[]` |
| routr.accessControlList.allow.[*] | Allow incoming traffic from network list | `[]` |
| routr.restService.bindAddr | Restful service listening address | `0.0.0.0` |
| routr.restService.port | Restful service port | `4567` |
| routr.restService.minThreads | Minimum thread allocation | `8` |
| routr.restService.maxThreads | Maximum thread allocation | `200` |
| routr.restService.timeoutMillis | Will reject requests that last more than this value | `5000` (5 seconds) |
| routr.restService.unsecured | Disabled https for restful calls | `false` |
| routr.restService.keyStore | Path to keyStore | `/opt/routr/etc/certs/api-cert.jks` |
| routr.restService.trueStore | Path to trueStore | `/opt/routr/etc/certs/api-cert.jks` |
| routr.restService.keyStorePassword | Password for keyStore | `changeit` |
| routr.restService.trueStorePassword | Password for trueStore | `changeit` |
| routr.securityContext.keyStore | Path to keyStore  | `/opt/routr/etc/certs/domain-cert.jks` |
| routr.securityContext.trustStore | Path to trueStore  | `/opt/routr/etc/certs/domain-cert.jks` |
| routr.securityContext.keyStorePassword | Password for keyStore  | `changeit` |
| routr.securityContext.keyStoreType | KeyStore type  | `jks` |
| routr.securityContext.client.authType | Type of client authentication. See https://goo.gl/1vKbXW for more options | `DisabledAll` |
| routr.securityContext.client.protocols.[*] | Accepted TLS protocols | [`TLSv1.2`, `TLSv1.1`, `TLSv1`] |
| routr.securityContext.debugging | Turns ON or OFF ssl debugging | `false` |
| routr.logLevel |  | `warn` |

## Redis Configuration

This is taken from Bitnami Helm Chart. Please refer to https://bitnami.com/stack/redis/helm

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
    size: 20Gi
```    

## Persistance

Coming Soon...

## TLS Certificates

Coming Soon...

## Security

Coming Soon...

## Specifying Values

Specify each parameter using the --set key=value[,key=value] argument to helm install. For example,

```bash
$ helm install --wait my-release \
    --set service.type=LoadBalancer \
    routr/routr-server
```

Alternatively, a YAML file that specifies the values for the above parameters can be provided while installing the chart. For example,

```bash
$ helm install --wait my-release -f values.yaml routr/routr-server
```
