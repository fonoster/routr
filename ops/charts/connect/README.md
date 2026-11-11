# Routr Connect

Routr Connect is a lightweight sip proxy, location server, and registrar that provides a reliable and scalable SIP infrastructure for telephony carriers, communication service providers, and integrators.

Website: https://routr.io

## TL;DR;

```bash
$ helm repo add routr https://routr.io/charts
$ helm repo update
$ helm install routr routr/routr-connect
```

**Note**: `routr` is your release name.

## Introduction

This chart bootstraps an [Routr Connect](https://routr.io) deployment on a [Kubernetes](http://kubernetes.io/) cluster using the [Helm](https://helm.sh/) package manager.

## Prerequisites

- Kubernetes v1.25.4+
- Helm v3.11.1
- PV provisioner support in the underlying infrastructure

## Add this Helm repository to your Helm client

```bash
helm repo add routr https://routr.io/charts
```

## Installing the Chart

To install the chart with the release name my-release:

```bash
$ kubectl create namespace routr
$ helm install my-release routr/routr-connect --namespace routr
```

The command deploys Routr Server in the `routr` namespace on the Kubernetes cluster in the default configuration.

We recommend using a namespace for easy upgrades.

The [configuration](https://hub.helm.sh/#configuration) section lists the parameters that can be configured during installation.

## Upgrading the Chart

### Scale-out defaults (breaking)

Connect, the Data API and Location now run 2 replicas each (the Dispatcher too, when on), with CPU and memory requests, a spread over the nodes and a PodDisruptionBudget. Their gRPC clients dial new headless Services (`<release>-routr-<component>-headless`) and balance round robin over every pod. The HorizontalPodAutoscalers are off unless `<component>.autoscaling.enabled` is true. The EdgePorts get a required pod anti-affinity: at most one per node, so `edgeport.replicas` must not exceed the nodes that can run them; on a single-node cluster set it to `1`. A Location on the memory cache must set `location.replicas: 1`. To keep the old shape, set `replicas: 1`, `resources.requests: {}` and `autoscaling.enabled: true` per component.

### From 0.4.7 or earlier

The EdgePort StatefulSet now uses the `<release>-routr-edgeport-headless` Service as its governing Service. Kubernetes doesn't allow changing that field on an existing StatefulSet, so delete the StatefulSet first, leaving its pods running, and then upgrade:

```bash
$ kubectl delete statefulset my-release-routr-edgeport --cascade=orphan --namespace routr
$ helm upgrade my-release routr/routr-connect --namespace routr
```

The pods keep serving traffic until the upgraded StatefulSet replaces them.

### From 0.4.x (Routr 2) to 0.5 (Routr 3)

Routr 3 runs on the same database and the same image names, with no migration. Every image is now the Go component, which takes its settings from a config file the chart mounts from your values. Secrets stay in the same Kubernetes Secrets; the config files name them with `secret://k8s/<secret>#<key>` references, mounted at `/var/run/routr/secrets/<secret>`.

Check these before upgrading:

| Value | Change |
| ----- | ------ |
| `global.logsLevel` | Takes `debug`, `info`, `warn` or `error`. Routr 2's `verbose` and `silly` make the chart fail: use `debug` |
| `connect.trustedRegistryAddresses` | New, default the Requester's headless Service, which covers exactly its pods. See [Trunk registration](#trunk-registration) |
| `edgeport.podCIDR` | New, off by default. For user agents inside the cluster: set it to the pod network (`10.244.0.0/16`) and each EdgePort's localnet becomes `${POD_IP}/<prefix>`, so it reaches pods without `externalAddrs`. Leave it off when phones outside the cluster use private addresses in that range (Calico's default pool 192.168.0.0/16 is most home routers' range): they would look local and get the pod IP in their Record-Route |
| `connect.trustedEdgePortAddresses` | New, default the EdgePorts' headless Service, which covers exactly the release's EdgePorts, so a call that crosses two of them completes |
| `requester.autoscaling.enabled` | New, default `false`: the Requester's HorizontalPodAutoscaler, rendered always before, is opt-in like the other components'; `requester.replicas` (default `1`) sets the pods |
| `rtprelay.autoscaling.enabled` | New, default `false`: the RTPRelay's HorizontalPodAutoscaler, rendered always before while `rtprelay.enabled` is `true`, is opt-in like the other components'; `rtprelay.replicas` (default `1`) sets the pods |
| `connect.trustedEdgePorts`, `connect.nonceMaxAge`, `connect.registerDefaultExpires`, `connect.verifierAddr`, `connect.untrustedHeadersToStrip` | New: the settings Routr 2's Connect took from its environment |
| `registry.enabled` | New, default `true`. `false` also leaves out the Requester |
| `apiserver.migrations.image.tag` | Follows `appVersion`: the image is Routr 3's, built from `ops/pgdata-migrations` with Routr 2's migrations unchanged, so a Routr 2 database finds nothing to apply. A tag you set still wins |
| `apiserver.tlsOn` | Read again, default `true`: the Data API serves TLS on 51907, and the Service's `external` port 51908 reaches the same listener. The liveness probe becomes a TCP check, since a Kubernetes gRPC probe can't speak TLS. See [Securing the Data API](#securing-the-data-api) |
| `apiserver.verifyClientCert` | Read again, default `false`. It now means a client certificate is one way in, next to the API key, not the only one. Needs `tlsSecret`: the generated CA keeps no key, so no client certificate can be issued against it |
| `apiserver.tlsSecret` | New: a Secret with `tls.crt`, `tls.key` and `ca.crt`. Empty, the default, generates a CA and a certificate once |
| `apiserver.apiKey` | New: the API key of the Data API and the Requester. Empty, the default, generates one once into `<release>-routr-api-key` |
| `apiserver.apiKeySecret` | New: an existing Secret holding the API key under the key `apiKey`, instead of `apiKey` or the generated one |
| `networkPolicy.enabled` | New, default `true`. On a CNI that enforces NetworkPolicy, an EdgePort, Dispatcher or processor outside the release that dials the internal services loses access: list it in `networkPolicy.ingressFrom` |
| `edgeport.heplifyOptions` | Removed: the Go EdgePort image doesn't ship heplify |
| `postgresql.auth.database` | New, default `routr`. Only applies to a new database |
| `rtprelay.rtpeHost` | Now required when `rtprelay.enabled` is `true` |

Labels and annotations are quoted, so a release named `n`, `on` or `123` renders; the Bitnami PostgreSQL and Redis subcharts still write the name unquoted, so the chart refuses such a name unless `postgresql.enabled` and `redis.enabled` are `false`.

The Secret `<release>-routr-edgeport-config` became a ConfigMap of the same name, now that it holds no password. The log4j2 ConfigMaps are gone. The Requester's and the Registry's probes follow the components: the Requester answers gRPC health on 51909.

## Where your user agents run

User agents that run inside the cluster need `edgeport.podCIDR`; phones and carriers outside it need `edgeport.externalAddrs`. A user agent inside the cluster is reached at its pod IP only when the EdgePort counts the pod network as local; without `podCIDR`, the EdgePort's localnet on Calico or Cilium is its own /32 and the call fails with `unable to find a valid interface`. A phone outside the cluster must get an address it can reach in `Via` and `Record-Route`, which is `externalAddrs`. When both kinds of client use the same private range (Calico's default pool, 192.168.0.0/16, is what most home routers hand out), prefer `externalAddrs` alone, or move the pod pool.

## Securing the Data API

The Data API returns decrypted credentials and takes writes, and the Requester sends arbitrary SIP, so both refuse to start without authentication. The chart keeps one API key in the Secret `<release>-routr-api-key` and gives it to the Data API, the Requester, Connect and the Registry. A new install or an upgrade generates it once. Rotating it means setting `apiserver.apiKey`, which rolls those pods; a call between them may fail until they all restart. The pods carry a hash of a key set in values, so it must be random (the chart generates 48 random characters), or use `apiserver.apiKeySecret`.

To keep the key in a Secret of your own, set `apiserver.apiKeySecret` to its name; it holds the key under `apiKey`. The chart neither reads nor writes it: the pods mount it. Rotating it means editing that Secret and then restarting the apiserver, requester, connect and registry Deployments, which read the key at start. The generated Secret is kept (`helm.sh/resource-policy: keep`), so you can move back to it by unsetting the value.

With `apiserver.tlsOn`, the default, the Data API's certificate comes from `apiserver.tlsSecret` or a CA the chart generates once, valid for ten years, in `<release>-routr-apiserver-tls`. It names the Service and `localhost`, for `kubectl port-forward`. The Requester takes the key over plaintext inside the cluster (`requesterAuth.insecure: true`); no Service publishes it outside. With `networkPolicy.enabled`, the default, a NetworkPolicy admits only the release's pods to it and to Location, Connect, the Dispatcher and the RTPRelay, which authenticate nobody. It protects only on a CNI that enforces NetworkPolicy.

The Helm `lookup` that keeps generated values needs access to the cluster. Something that renders the chart without it, such as a GitOps controller or `helm template`, gets a new key and certificate each time: set `apiserver.apiKeySecret` or `apiserver.apiKey`, and `apiserver.tlsSecret`.

`rctl` and the SDK reach the Data API with the key and the CA, as the install's notes show. Anything else you wrote against 51907 must now send `authorization: Bearer <key>` and speak TLS.

## Trunk registration

The Registry's REGISTER carries a Trunk's credentials in `X-Gateway-Auth`, and Connect honors that header only from `connect.trustedRegistryAddresses`. The Requester's pods have no fixed IP, so the default is a DNS name: `<release>-routr-requester-headless.<namespace>`, a headless Service that resolves to exactly those pods. Connect resolves it again every 10 seconds, so a new pod is trusted within that time and its first REGISTER may be challenged; the next round goes through.

If the name stops resolving, Connect keeps its last addresses for 30 seconds and then trusts nothing, logging `X-Gateway-Auth from an address not in trustedRegistryAddresses` for each REGISTER it refuses.

The list also takes IPs, CIDRs and other names, for a Requester outside the release. An empty list fails the install while `registry.enabled` is `true`. A CIDR that covers the pod network is a poor substitute: with `externalTrafficPolicy: Cluster`, the default, a node can rewrite an outside caller's address into it, and Connect would then relay that caller's REGISTER.

## Uninstalling the Chart

To uninstall/delete the `my-release` deployment:

`helm delete my-release --namespace routr`

The command removes all the Kubernetes components but PVC's associated with the chart and deletes the release.

To delete the PVC's associated with my-release:

`kubectl delete pvc -l app.kubernetes.io/instance=my-release --namespace routr`

> Note: Deleting the PVC's will delete postgresql data as well. Please be cautious before doing it.

The generated API-key Secret, `my-release-routr-api-key`, also stays after `helm delete`: it carries `helm.sh/resource-policy: keep`, so a reinstall under the same name finds the same key. Delete it by hand to start over:

`kubectl delete secret my-release-routr-api-key --namespace routr`

## Changelog

The [CHANGELOG](https://github.com/fonoster/routr/tree/gh-pages/charts/CHANGELOG.md) provides notable changes on the chart.

## Parameters

### Global parameters

| Parameter            | Description                                      | Value     |
| -------------------- | ------------------------------------------------ | --------- |
| `global.region`      | Region for the cluster (reserved for future use) | `default` |
| `global.logsLevel`   | `logLevel` of every component: `debug`, `info`, `warn` or `error` | `info`    |
| `global.otlpEndpoint` | OTLP/HTTP endpoint for traces, metrics and logs, written as `telemetry.otlpEndpoint` in every component's file; unset turns it off |           |

### NetworkPolicy parameters

| Parameter                   | Description                                      | Value  |
| --------------------------- | ------------------------------------------------ | ------ |
| `networkPolicy.enabled`     | One NetworkPolicy per internal gRPC service (location, connect, dispatcher, requester, rtprelay): only this release's pods, plus `ingressFrom`, reach them. The Data API gets none: it authenticates callers. On a CNI that doesn't enforce NetworkPolicy these objects do nothing | `true` |
| `networkPolicy.ingressFrom` | Extra peers admitted to the internal services, as NetworkPolicy `from` entries: an EdgePort, a Dispatcher or a processor outside this release (another release of this chart named in `dispatcher.processors[].servicePrefix` included), e.g. `[{namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: sip-edge}}}]` | `[]`   |

### Edgeport parameters

| Parameter                                           | Description                                                                                                   | Value                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `edgeport.externalAddrs`                            | The addresses the EdgePort advertises to endpoints outside its localnets. Phones and carriers outside the cluster need them | `[]` |
| `edgeport.podCIDR`                                  | Off (empty) by default. For user agents inside the cluster: the pod network, whose prefix length makes each EdgePort's localnet `${POD_IP}/<prefix>`. Leave it empty when phones outside the cluster use private addresses in that range: they would get the pod IP in their Record-Route. Empty reads the pod's interfaces | `""` |
| `edgeport.localnets`                                | The set of local networks that are considered "local". Overrides `podCIDR`. Write each entry as `${POD_IP}/<prefix>`  |                                                             |
| `edgeport.methods`                                  | The methods of requests that start something. Requests in a dialog, and every ACK and CANCEL, always pass; another out-of-dialog method follows `edgeport.unknownMethodAction` | `["REGISTER", "MESSAGE", "INVITE", "ACK", "BYE", "CANCEL", "REFER", "NOTIFY", "OPTIONS"]` |
| `edgeport.unknownMethodAction`                      | What the EdgePort does with an out-of-dialog request whose method isn't in `edgeport.methods`: `Discard` sends no answer; `Respond` answers `501 Not Implemented` | `Discard`                                                   |
| `edgeport.pkcs12Password`                           | The keystore password of the TLS and WSS transports (Please change it for production environments)            | `changeme`                                                  |
| `edgeport.tls.protocols`                            | TLS versions for the TLS and WSS transports. Unset accepts `TLSv1.3` only                                     |                                                             |
| `edgeport.tls.cipherSuites`                         | Cipher suites for the TLS and WSS transports. Unset uses forward-secret AEAD suites                           |                                                             |
| `edgeport.transport`                                | Transport configuration section                                                                               |                                                             |
| `edgeport.transport.tcp.enabled`                    | Enable or disable the TCP transport                                                                           | `false`                                                     |
| `edgeport.transport.tcp.port`                       | Port to listen on                                                                                             | `5060`                                                      |
| `edgeport.transport.udp.enabled`                    | Enable or disable the UDP transport                                                                           | `true`                                                      |
| `edgeport.transport.udp.port`                       | Port to listen on                                                                                             | `5060`                                                      |
| `edgeport.transport.tls.enabled`                    | Enable or disable the TLS transport                                                                           | `false`                                                     |
| `edgeport.transport.tls.port`                       | Port to listen on                                                                                             | `5061`                                                      |
| `edgeport.transport.ws.enabled`                     | Enable or disable the WS transport                                                                            | `false`                                                     |
| `edgeport.transport.ws.port`                        | Port to listen on                                                                                             | `5062`                                                      |
| `edgeport.transport.wss.enabled`                    | Enable or disable the WSS transport                                                                           | `false`                                                     |
| `edgeport.transport.wss.port`                       | Port to listen on                                                                                             | `5063`                                                      |
| `edgeport.udpHealthCheck`                           | Enable or disable the UDP health check                                                                        | `false`                                                     |
| `edgeport.env` | Extra environment variables for the container, like `GOMAXPROCS` | `[]` |
| `edgeport.image.repository`                         | Image repository                                                                                              | `fonoster/routr-edgeport`                                   |
| `edgeport.image.tag`                                | Image tag                                                                                                     | `{{ .Chart.AppVersion }}`                                   |
| `edgeport.image.pullPolicy`                         | Image pull policy                                                                                             | `IfNotPresent`                                              |
| `edgeport.podAnnotations`                           | Pod annotations                                                                                               | `{}`                                                        |
| `edgeport.serviceAnnotationsTCP`                    | Service annotations for TCP protocols                                                                         | `{}`                                                        |
| `edgeport.serviceAnnotationsUDP`                    | Service annotations for UDP protocols                                                                         | `{}`                                                        |
| `edgeport.replicas` | EdgePort pods, at most one per node (required pod anti-affinity): the number of nodes that take SIP traffic | `2` |
| `edgeport.securityContext.runAsUser`                | Running as a non-root user                                                                                    | `1000`                                                      |
| `edgeport.securityContext.runAsGroup`               | Running as non-root group                                                                                     | `3000`                                                      |
| `edgeport.securityContext.fsGroup`                  | File system group                                                                                             | `2000`                                                      |
| `edgeport.securityContext.allowPrivilegeEscalation` | By default, no privilege escalation is allowed                                                                | `false`                                                     |
| `edgeport.livenessProbe.initialDelaySeconds`        | Initial delay in seconds before starting the liveness probe                                                   | `10`                                                        |
| `edgeport.livenessProbe.periodSeconds`              | Period between liveness probes                                                                                | `5`                                                         |
| `edgeport.livenessProbe.successThreshold`           | Number of successes required to be considered healthy                                                         | `1`                                                         |
| `edgeport.livenessProbe.failureThreshold`           | Number of failures required to be considered unhealthy                                                        | `2`                                                         |
| `edgeport.livenessProbe.timeoutSeconds`             | Timeout in seconds for liveness probe                                                                         | `1`                                                         |
| `edgeport.externalTrafficPolicyTCP`                 | Denotes if this Service desires to route external traffic to node-local or cluster-wide endpoints (TCP)       | `Cluster`                                                   |
| `edgeport.externalTrafficPolicyUDP`                 | Denotes if this Service desires to route external traffic to node-local or cluster-wide endpoints (UDP)       | `Cluster`                                                   |
| `edgeport.serviceTypeTCP`                           | The type for the service for TCP                                                                              | `NodePort`                                                  |
| `edgeport.serviceTypeUDP`                           | The type for the service for UDP                                                                              | `NodePort`                                                  |
| `edgeport.terminationGracePeriodSeconds`            | Maximum time for the pod to be ready before being killed                                                      | `10`                                                        |
| `edgeport.resources.requests`                       | Resource requests (e.g. `{"memory": "256Mi", "cpu": "100m"}`)                                                 | `{}`                                                        |
| `edgeport.resources.limits`                         | Resource limits (e.g. `{"memory": "512Mi", "cpu": "200m"}`)                                                   | `{}`                                                        |

### Dispatcher parameters

| Parameter                                                  | Description                                                   | Value                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| `dispatcher.processors`                                    | Processors configuration section                              | `[]`                                                        |
| `dispatcher.processors[*].ref`                             | Reference to the Processor                                    | `connect-processor`                                         |
| `dispatcher.processors[*].servicePrefix`                   | Prefix for the service (Defaults to the release name)         | `{{ .Release.Name }}`                                       |
| `dispatcher.processors[*].serviceName` | The name of the service hosting the processor; a headless one spreads the calls over its pods | `routr-connect-headless` |
| `dispatcher.processors[*].serviceNamespace`                | The namespace for the service (Defaults to the release ns)    | `{{ .Release.Namespace }}`                                  |
| `dispatcher.processors[*].matchFunc`                       | Routing function                                              | `req => true`                                               |
| `dispatcher.processors[*].methods`                         | Acceptable methods                                            | `["REGISTER", "MESSAGE", "INVITE", "ACK", "BYE", "CANCEL"]` |
| `dispatcher.middlewares`                                   | Middlewares configuration section                             | `[]`                                                        |
| `dispatcher.middlewares[*].ref`                            | Reference to the Middleware                                   | `{{ .ref }}`                                                |
| `dispatcher.middlewares[*].servicePrefix`                  | Prefix for the service (Defaults to the release name)         | `{{ .Release.Name }}`                                       |
| `dispatcher.middlewares[*].serviceName`                    | The name of the service hosting the middleware                | `{{ .serviceName }}`                                        |
| `dispatcher.middlewares[*].serviceNamespace`               | The namespace for the service (Defaults to the release ns)    | `{{ .Release.Namespace }}`                                  |
| `dispatcher.middlewares[*].postProcessor`                  | If set to true the middleware will run after the processor    | `{{ .postProcessor }}`                                      |
| `dispatcher.enabled` | Run the Dispatcher between the EdgePorts and Connect; needed for recording and middlewares | `false` |
| `dispatcher.env` | Extra environment variables for the container, like `GOMAXPROCS` | `[]` |
| `dispatcher.image.repository`                              | Image repository                                              | `fonoster/routr-dispatcher`                                 |
| `dispatcher.image.tag`                                     | Image tag                                                     | `{{ .Chart.AppVersion }}`                                   |
| `dispatcher.image.pullPolicy`                              | Image pull policy                                             | `IfNotPresent`                                              |
| `dispatcher.podAnnotations`                                | Pod annotations                                               | `{}`                                                        |
| `dispatcher.serviceAnnotations`                            | Service annotations                                           | `{}`                                                        |
| `dispatcher.replicas` | Pods of the Deployment when autoscaling is off; the gRPC clients balance over all of them. | `2` |
| `dispatcher.topologySpread` | Spreads the pods over the nodes (`maxSkew`, `topologyKey`, `whenUnsatisfiable`); `{}` turns it off | `{"maxSkew": 1, "topologyKey": "kubernetes.io/hostname", "whenUnsatisfiable": "ScheduleAnyway"}` |
| `dispatcher.pdb.enabled` | A PodDisruptionBudget, rendered with more than one replica or the autoscaler | `true` |
| `dispatcher.pdb.minAvailable` | Pods kept through a node drain | `1` |
| `dispatcher.autoscaling.enabled` | A HorizontalPodAutoscaler instead of `replicas` (needs metrics-server) | `false` |
| `dispatcher.autoscaling.minReplicas`                       | Minimum number of replicas                                    | `1`                                                         |
| `dispatcher.autoscaling.maxReplicas`                       | Maximum number of replicas                                    | `10`                                                        |
| `dispatcher.autoscaling.targetCPUUtilizationPercentage`    | Target CPU utilization percentage                             | `50`                                                        |
| `dispatcher.autoscaling.targetMemoryUtilizationPercentage` | Target Memory utilization percentage                          | `70`                                                        |
| `dispatcher.securityContext.runAsUser`                     | Running as a non-root user                                    | `1000`                                                      |
| `dispatcher.securityContext.runAsGroup`                    | Running as non-root group                                     | `3000`                                                      |
| `dispatcher.securityContext.fsGroup`                       | File system group                                             | `2000`                                                      |
| `dispatcher.securityContext.allowPrivilegeEscalation`      | By default, no privilege escalation is allowed                | `false`                                                     |
| `dispatcher.livenessProbe.initialDelaySeconds`             | Initial delay in seconds before starting the liveness probe   | `5`                                                         |
| `dispatcher.livenessProbe.periodSeconds`                   | Period between liveness probes                                | `5`                                                         |
| `dispatcher.livenessProbe.successThreshold`                | Number of successes required to be considered healthy         | `1`                                                         |
| `dispatcher.livenessProbe.failureThreshold`                | Number of failures required to be considered unhealthy        | `2`                                                         |
| `dispatcher.livenessProbe.timeoutSeconds`                  | Timeout in seconds for liveness probe                         | `1`                                                         |
| `dispatcher.resources.requests` | Resource requests; the scheduler places the pods by them | `{"cpu": "250m", "memory": "64Mi"}` |
| `dispatcher.resources.limits` | Resource limits; none by default, so a pod uses idle cores | `{}` |

### Location parameters

| Parameter                                                | Description                                                   | Value                     |
| -------------------------------------------------------- | ------------------------------------------------------------- | ------------------------- |
| `location.region`                                        | Region for Location service (reserved for future use)         | `default`                 |
| `location.cache.provider`                                | Cache Provider (supports for `redis` and `memory` )           | `redis`                   |
| `location.cache.parameters`                              | Cache Parameters                                              | `""`                      |
| `location.env` | Extra environment variables for the container, like `GOMAXPROCS` | `[]` |
| `location.image.repository`                              | Image repository                                              | `fonoster/routr-location` |
| `location.image.tag`                                     | Image tag                                                     | `{{ .Chart.AppVersion }}` |
| `location.image.pullPolicy`                              | Image pull policy                                             | `IfNotPresent`            |
| `location.podAnnotations`                                | Pod annotations                                               | `{}`                      |
| `location.serviceAnnotations`                            | Service annotations                                           | `{}`                      |
| `location.replicas` | Pods of the Deployment when autoscaling is off; the gRPC clients balance over all of them. More than one needs the Redis cache | `2` |
| `location.topologySpread` | Spreads the pods over the nodes (`maxSkew`, `topologyKey`, `whenUnsatisfiable`); `{}` turns it off | `{"maxSkew": 1, "topologyKey": "kubernetes.io/hostname", "whenUnsatisfiable": "ScheduleAnyway"}` |
| `location.pdb.enabled` | A PodDisruptionBudget, rendered with more than one replica or the autoscaler | `true` |
| `location.pdb.minAvailable` | Pods kept through a node drain | `1` |
| `location.autoscaling.enabled` | A HorizontalPodAutoscaler instead of `replicas` (needs metrics-server) | `false` |
| `location.autoscaling.minReplicas`                       | Minimum number of replicas                                    | `1`                       |
| `location.autoscaling.maxReplicas`                       | Maximum number of replicas                                    | `10`                      |
| `location.autoscaling.targetCPUUtilizationPercentage`    | Target CPU utilization percentage                             | `50`                      |
| `location.autoscaling.targetMemoryUtilizationPercentage` | Target Memory utilization percentage                          | `70`                      |
| `location.securityContext.runAsUser`                     | Running as a non-root user                                    | `1000`                    |
| `location.securityContext.runAsGroup`                    | Running as non-root group                                     | `3000`                    |
| `location.securityContext.fsGroup`                       | File system group                                             | `2000`                    |
| `location.securityContext.allowPrivilegeEscalation`      | By default, no privilege escalation is allowed                | `false`                   |
| `location.livenessProbe.initialDelaySeconds`             | Initial delay in seconds before starting the liveness probe   | `5`                       |
| `location.livenessProbe.periodSeconds`                   | Period between liveness probes                                | `5`                       |
| `location.livenessProbe.successThreshold`                | Number of successes required to be considered healthy         | `1`                       |
| `location.livenessProbe.failureThreshold`                | Number of failures required to be considered unhealthy        | `2`                       |
| `location.livenessProbe.timeoutSeconds`                  | Timeout in seconds for liveness probe                         | `1`                       |
| `location.resources.requests` | Resource requests; the scheduler places the pods by them | `{"cpu": "100m", "memory": "64Mi"}` |
| `location.resources.limits` | Resource limits; none by default, so a pod uses idle cores | `{}` |

### APIServer parameters

| Parameter                                                 | Description                                                             | Value                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| `apiserver.databaseUrl`                                   | URL of an external Postgres, instead of the chart's own                 |                                    |
| `apiserver.env` | Extra environment variables for the container, like `GOMAXPROCS` | `[]` |
| `apiserver.image.repository`                              | Image repository                                                        | `fonoster/routr-pgdata`            |
| `apiserver.image.tag`                                     | Image tag                                                               | `{{ .Chart.AppVersion }}`          |
| `apiserver.image.pullPolicy`                              | Image pull policy                                                       | `IfNotPresent`                     |
| `apiserver.migrations.enabled`                            | Enables database migrations                                             | `true`                             |
| `apiserver.migrations.image.repository`                   | Migration image repository                                              | `fonoster/routr-pgdata-migrations` |
| `apiserver.migrations.image.tag`                          | Migration image tag                                                     | `{{ .Chart.AppVersion }}`          |
| `apiserver.migrations.image.pullPolicy`                   | Migration image pull policy                                             | `IfNotPresent`                     |
| `apiserver.migrations.resources.limits`                   | Migration resource limits (e.g. `{"memory": "256Mi", "cpu": "100m"}`)   | `{}`                               |
| `apiserver.migrations.resources.requests`                 | Migration resource requests (e.g. `{"memory": "256Mi", "cpu": "100m"}`) | `{}`                               |
| `apiserver.tlsOn`                                         | Serves the Data API over TLS                                            | `true`                             |
| `apiserver.verifyClientCert`                              | Accepts client certificates of the CA, next to the API key. Needs `tlsSecret`: the generated CA keeps no key, so no client certificate can be issued against it | `false`                            |
| `apiserver.tlsSecret`                                     | Secret with `tls.crt`, `tls.key` and `ca.crt`; empty generates one      | `""`                               |
| `apiserver.apiKey`                                        | API key of the Data API and the Requester; empty generates one. The pods carry a hash of it, so use a random value, or `apiKeySecret` | `""`                               |
| `apiserver.apiKeySecret`                                  | Existing Secret holding the API key under the key `apiKey`, instead of `apiKey` or the generated one | `""`                               |
| `apiserver.cloakEncryptionKey`                            | Cloak encryption key                                                    | `""`                               |
| `apiserver.podAnnotations`                                | Pod annotations                                                         | `{}`                               |
| `apiserver.serviceAnnotations`                            | Service annotations                                                     | `{}`                               |
| `apiserver.replicas` | Pods of the Deployment when autoscaling is off; the gRPC clients balance over all of them. | `2` |
| `apiserver.topologySpread` | Spreads the pods over the nodes (`maxSkew`, `topologyKey`, `whenUnsatisfiable`); `{}` turns it off | `{"maxSkew": 1, "topologyKey": "kubernetes.io/hostname", "whenUnsatisfiable": "ScheduleAnyway"}` |
| `apiserver.pdb.enabled` | A PodDisruptionBudget, rendered with more than one replica or the autoscaler | `true` |
| `apiserver.pdb.minAvailable` | Pods kept through a node drain | `1` |
| `apiserver.autoscaling.enabled` | A HorizontalPodAutoscaler instead of `replicas` (needs metrics-server) | `false` |
| `apiserver.autoscaling.minReplicas`                       | Minimum number of replicas                                              | `1`                                |
| `apiserver.autoscaling.maxReplicas`                       | Maximum number of replicas                                              | `10`                               |
| `apiserver.autoscaling.targetCPUUtilizationPercentage`    | Target CPU utilization percentage                                       | `50`                               |
| `apiserver.autoscaling.targetMemoryUtilizationPercentage` | Target Memory utilization percentage                                    | `70`                               |
| `apiserver.securityContext.runAsUser`                     | Running as a non-root user                                              | `1000`                             |
| `apiserver.securityContext.runAsGroup`                    | Running as non-root group                                               | `3000`                             |
| `apiserver.securityContext.fsGroup`                       | File system group                                                       | `2000`                             |
| `apiserver.securityContext.allowPrivilegeEscalation`      | By default, no privilege escalation is allowed                          | `false`                            |
| `apiserver.livenessProbe.initialDelaySeconds`             | Initial delay in seconds before starting the liveness probe             | `5`                                |
| `apiserver.livenessProbe.periodSeconds`                   | Period between liveness probes                                          | `5`                                |
| `apiserver.livenessProbe.successThreshold`                | Number of successes required to be considered healthy                   | `1`                                |
| `apiserver.livenessProbe.failureThreshold`                | Number of failures required to be considered unhealthy                  | `2`                                |
| `apiserver.livenessProbe.timeoutSeconds`                  | Timeout in seconds for liveness probe                                   | `1`                                |
| `apiserver.resources.requests` | Resource requests; the scheduler places the pods by them | `{"cpu": "250m", "memory": "128Mi"}` |
| `apiserver.resources.limits` | Resource limits; none by default, so a pod uses idle cores | `{}` |

### Connect Processor parameters

| Parameter                                               | Description                                                   | Value                     |
| ------------------------------------------------------- | ------------------------------------------------------------- | ------------------------- |
| `connect.nonceMaxAge`                                   | How long a digest nonce stays valid, in seconds               | `300`                     |
| `connect.registerDefaultExpires`                        | The expiry granted to a REGISTER that names none, in seconds  | `3600`                    |
| `connect.verifierAddr`                                  | The Verifier service that checks Connect Tokens               |                           |
| `connect.untrustedHeadersToStrip`                       | Platform headers removed from untrusted requests              | Connect's default list    |
| `connect.trustedEdgePorts`                              | Which `X-Edgeport-Ref` values are honored; empty is any       | `[]`                      |
| `connect.trustedEdgePortAddresses`                      | Peer EdgePorts, as IPs, CIDRs or DNS names (templates); empty trusts none. Don't list the pod network: NodePort clients can arrive from inside it | `["{{ .Release.Name }}-routr-edgeport-headless.{{ .Release.Namespace }}"]` |
| `connect.trustedRegistryAddresses`                      | Where a Trunk's REGISTER may come from, as IPs, CIDRs or DNS names; entries are templates (see above) | `["{{ .Release.Name }}-routr-requester-headless.{{ .Release.Namespace }}"]` |
| `connect.env` | Extra environment variables for the container, like `GOMAXPROCS` | `[]` |
| `connect.image.repository`                              | Image repository                                              | `fonoster/routr-connect`  |
| `connect.image.tag`                                     | Image tag                                                     | `{{ .Chart.AppVersion }}` |
| `connect.image.pullPolicy`                              | Image pull policy                                             | `IfNotPresent`            |
| `connect.podAnnotations`                                | Pod annotations                                               | `{}`                      |
| `connect.serviceAnnotations`                            | Service annotations                                           | `{}`                      |
| `connect.replicas` | Pods of the Deployment when autoscaling is off; the gRPC clients balance over all of them. | `2` |
| `connect.topologySpread` | Spreads the pods over the nodes (`maxSkew`, `topologyKey`, `whenUnsatisfiable`); `{}` turns it off | `{"maxSkew": 1, "topologyKey": "kubernetes.io/hostname", "whenUnsatisfiable": "ScheduleAnyway"}` |
| `connect.pdb.enabled` | A PodDisruptionBudget, rendered with more than one replica or the autoscaler | `true` |
| `connect.pdb.minAvailable` | Pods kept through a node drain | `1` |
| `connect.autoscaling.enabled` | A HorizontalPodAutoscaler instead of `replicas` (needs metrics-server) | `false` |
| `connect.autoscaling.minReplicas`                       | Minimum number of replicas                                    | `1`                       |
| `connect.autoscaling.maxReplicas`                       | Maximum number of replicas                                    | `10`                      |
| `connect.autoscaling.targetCPUUtilizationPercentage`    | Target CPU utilization percentage                             | `50`                      |
| `connect.autoscaling.targetMemoryUtilizationPercentage` | Target Memory utilization percentage                          | `70`                      |
| `connect.securityContext.runAsUser`                     | Running as a non-root user                                    | `1000`                    |
| `connect.securityContext.runAsGroup`                    | Running as non-root group                                     | `3000`                    |
| `connect.securityContext.fsGroup`                       | File system group                                             | `2000`                    |
| `connect.securityContext.allowPrivilegeEscalation`      | By default, no privilege escalation is allowed                | `false`                   |
| `connect.livenessProbe.initialDelaySeconds`             | Initial delay in seconds before starting the liveness probe   | `5`                       |
| `connect.livenessProbe.periodSeconds`                   | Period between liveness probes                                | `5`                       |
| `connect.livenessProbe.successThreshold`                | Number of successes required to be considered healthy         | `1`                       |
| `connect.livenessProbe.failureThreshold`                | Number of failures required to be considered unhealthy        | `2`                       |
| `connect.livenessProbe.timeoutSeconds`                  | Timeout in seconds for liveness probe                         | `1`                       |
| `connect.resources.requests` | Resource requests; the scheduler places the pods by them | `{"cpu": "500m", "memory": "128Mi"}` |
| `connect.resources.limits` | Resource limits; none by default, so a pod uses idle cores | `{}` |

### Registry parameters

| Parameter                                           | Description                                                   | Value                     |
| --------------------------------------------------- | ------------------------------------------------------------- | ------------------------- |
| `registry.enabled`                                  | Deploys the Registry and the Requester                        | `true`                    |
| `registry.registerInterval`                         | Registration interval in seconds                              | `20`                      |
| `registry.methods`                                  | Registration methods for the Allow header                     | `["INVITE", "MESSAGE"]`   |
| `registry.cache.provider`                           | Cache Provider (supports for `redis` and `memory` )           | `redis`                   |
| `registry.cache.parameters`                         | Cache Parameters                                              | `""`                      |
| `registry.image.repository`                         | Image repository                                              | `fonoster/routr-registry` |
| `registry.image.tag`                                | Image tag                                                     | `{{ .Chart.AppVersion }}` |
| `registry.image.pullPolicy`                         | Image pull policy                                             | `IfNotPresent`            |
| `registry.podAnnotations`                           | Pod annotations                                               | `{}`                      |
| `registry.serviceAnnotations`                       | Service annotations                                           | `{}`                      |
| `registry.securityContext.runAsUser`                | Running as a non-root user                                    | `1000`                    |
| `registry.securityContext.runAsGroup`               | Running as non-root group                                     | `3000`                    |
| `registry.securityContext.fsGroup`                  | File system group                                             | `2000`                    |
| `registry.securityContext.allowPrivilegeEscalation` | By default, no privilege escalation is allowed                | `false`                   |
| `registry.livenessProbe.initialDelaySeconds`        | Initial delay in seconds before starting the liveness probe   | `5`                       |
| `registry.livenessProbe.periodSeconds`              | Period between liveness probes                                | `5`                       |
| `registry.livenessProbe.successThreshold`           | Number of successes required to be considered healthy         | `1`                       |
| `registry.livenessProbe.failureThreshold`           | Number of failures required to be considered unhealthy        | `2`                       |
| `registry.livenessProbe.timeoutSeconds`             | Timeout in seconds for liveness probe                         | `1`                       |
| `registry.resources.requests`                       | Resource requests (e.g. `{"memory": "256Mi", "cpu": "100m"}`) | `{}`                      |
| `registry.resources.limits`                         | Resource limits (e.g. `{"memory": "512Mi", "cpu": "200m"}`)   | `{}`                      |

### Requester parameters

| Parameter                                                 | Description                                                   | Value                      |
| --------------------------------------------------------- | ------------------------------------------------------------- | -------------------------- |
| `requester.image.repository`                              | Image repository                                              | `fonoster/routr-requester` |
| `requester.image.tag`                                     | Image tag                                                     | `{{ .Chart.AppVersion }}`  |
| `requester.image.pullPolicy`                              | Image pull policy                                             | `IfNotPresent`             |
| `requester.podAnnotations`                                | Pod annotations                                               | `{}`                       |
| `requester.serviceAnnotations`                            | Service annotations                                           | `{}`                       |
| `requester.replicas`                                      | Pods of the Deployment, when `autoscaling.enabled` is false   | `1`                        |
| `requester.autoscaling.enabled`                           | A HorizontalPodAutoscaler instead of `replicas` (needs metrics-server) | `false`           |
| `requester.autoscaling.minReplicas`                       | Minimum number of replicas                                    | `1`                        |
| `requester.autoscaling.maxReplicas`                       | Maximum number of replicas                                    | `10`                       |
| `requester.autoscaling.targetCPUUtilizationPercentage`    | Target CPU utilization percentage                             | `50`                       |
| `requester.autoscaling.targetMemoryUtilizationPercentage` | Target Memory utilization percentage                          | `70`                       |
| `requester.securityContext.runAsUser`                     | Running as a non-root user                                    | `1000`                     |
| `requester.securityContext.runAsGroup`                    | Running as non-root group                                     | `3000`                     |
| `requester.securityContext.fsGroup`                       | File system group                                             | `2000`                     |
| `requester.securityContext.allowPrivilegeEscalation`      | By default, no privilege escalation is allowed                | `false`                    |
| `requester.livenessProbe.initialDelaySeconds`             | Initial delay in seconds before starting the liveness probe   | `10`                       |
| `requester.livenessProbe.periodSeconds`                   | Period between liveness probes                                | `5`                        |
| `requester.livenessProbe.successThreshold`                | Number of successes required to be considered healthy         | `1`                        |
| `requester.livenessProbe.failureThreshold`                | Number of failures required to be considered unhealthy        | `2`                        |
| `requester.livenessProbe.timeoutSeconds`                  | Timeout in seconds for liveness probe                         | `1`                        |
| `requester.resources.requests`                            | Resource requests (e.g. `{"memory": "256Mi", "cpu": "100m"}`) | `{}`                       |
| `requester.resources.limits`                              | Resource limits (e.g. `{"memory": "512Mi", "cpu": "200m"}`)   | `{}`                       |

### RTPRelay parameters

| Parameter                                                | Description                                                   | Value                     |
| -------------------------------------------------------- | ------------------------------------------------------------- | ------------------------- |
| `rtprelay.enabled`                                       | Enables the rtprelay Pod                                      | `false`                   |
| `rtprelay.rtpeHost`                                      | RTPEngine host, required when enabled                         | `""`                      |
| `rtprelay.rtpePort`                                      | RTPEngine admin port                                          | `22222`                   |
| `rtprelay.image.repository`                              | Image repository                                              | `fonoster/routr-rtprelay` |
| `rtprelay.image.tag`                                     | Image tag                                                     | `{{ .Chart.AppVersion }}` |
| `rtprelay.image.pullPolicy`                              | Image pull policy                                             | `IfNotPresent`            |
| `rtprelay.podAnnotations`                                | Pod annotations                                               | `{}`                      |
| `rtprelay.serviceAnnotations`                            | Service annotations                                           | `{}`                      |
| `rtprelay.replicas`                                      | Pods of the Deployment, when `autoscaling.enabled` is false   | `1`                       |
| `rtprelay.autoscaling.enabled`                           | A HorizontalPodAutoscaler instead of `replicas` (needs metrics-server) | `false`          |
| `rtprelay.autoscaling.minReplicas`                       | Minimum number of replicas                                    | `1`                       |
| `rtprelay.autoscaling.maxReplicas`                       | Maximum number of replicas                                    | `10`                      |
| `rtprelay.autoscaling.targetCPUUtilizationPercentage`    | Target CPU utilization percentage                             | `50`                      |
| `rtprelay.autoscaling.targetMemoryUtilizationPercentage` | Target Memory utilization percentage                          | `70`                      |
| `rtprelay.securityContext.runAsUser`                     | Running as a non-root user                                    | `1000`                    |
| `rtprelay.securityContext.runAsGroup`                    | Running as non-root group                                     | `3000`                    |
| `rtprelay.securityContext.fsGroup`                       | File system group                                             | `2000`                    |
| `rtprelay.securityContext.allowPrivilegeEscalation`      | By default, no privilege escalation is allowed                | `false`                   |
| `rtprelay.livenessProbe.initialDelaySeconds`             | Initial delay in seconds before starting the liveness probe   | `10`                      |
| `rtprelay.livenessProbe.periodSeconds`                   | Period between liveness probes                                | `5`                       |
| `rtprelay.livenessProbe.successThreshold`                | Number of successes required to be considered healthy         | `1`                       |
| `rtprelay.livenessProbe.failureThreshold`                | Number of failures required to be considered unhealthy        | `2`                       |
| `rtprelay.livenessProbe.timeoutSeconds`                  | Timeout in seconds for liveness probe                         | `1`                       |
| `rtprelay.resources.requests`                            | Resource requests (e.g. `{"memory": "256Mi", "cpu": "100m"}`) | `{}`                      |
| `rtprelay.resources.limits`                              | Resource limits (e.g. `{"memory": "512Mi", "cpu": "200m"}`)   | `{}`                      |

### Postgres Values

This is taken from Bitnami Helm Chart. Please refer to https://bitnami.com/stack/postgresql/helm

Bitnami no longer serves these images from `docker.io/bitnami`, so the chart pulls them from `bitnamilegacy`. Keep these `image` overrides if you copy the defaults into your own values. The move off Bitnami is tracked in [#347](https://github.com/fonoster/routr/issues/347).

Here are the default values:

```
# Postgresql Service defaults
postgresql:
  # Whether to enable PostgreSQL
  enabled: true
  image:
    repository: bitnamilegacy/postgresql
  volumePermissions:
    image:
      repository: bitnamilegacy/os-shell
      tag: 11-debian-11-r99
  metrics:
    image:
      repository: bitnamilegacy/postgres-exporter
  auth:
    # The database the chart's own URL names
    database: routr
    # Initial username for the database
    username: routr
    # Initial password for the database
    password: changeme
```

### Redis Values

This is taken from Bitnami Helm Chart. Please refer to https://bitnami.com/stack/postgres/helm

Like Postgres, these images come from `bitnamilegacy`.

Here are the default values:

```
# Redis Service defaults
redis:
  # Whether to enable Redis
  enabled: true
  architecture: standalone
  image:
    repository: bitnamilegacy/redis
  sentinel:
    image:
      repository: bitnamilegacy/redis-sentinel
  metrics:
    image:
      repository: bitnamilegacy/redis-exporter
  volumePermissions:
    image:
      repository: bitnamilegacy/os-shell
      tag: 11-debian-11-r99
  sysctl:
    image:
      repository: bitnamilegacy/os-shell
      tag: 11-debian-11-r99
  auth:
    enabled: false
```

## Specifying Values

Specify each parameter using the --set key=value[, key=value] argument to helm install. For example,

```bash
$ helm install --wait my-release \
  --set global.logsLevel=debug \
  routr/routr-connect
```

Alternatively, you can provide a YAML file that specifies the above parameters' values while installing the chart. For example:

```bash
$ helm install --wait my-release -f values.yaml routr/routr-connect
```
